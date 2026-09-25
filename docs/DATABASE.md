# Brainstorm — préparation intégration base de données

Objectif : remplacer `localStorage` par un modèle Postgres **multi-tenant**, sans attendre les sondes. Les mesures IoT arriveront plus tard dans la même base (Timescale), pas dans un second silo.

---

## 1. Ce que l’app stocke aujourd’hui

Une seule clé navigateur : `sud-contractors-profuel`.

| Champ UI | Nature | Problème en prod |
|---|---|---|
| `missionId`, `stage` | 1 mission | Pas d’historique, pas de concurrence |
| `truck`, `driver` | Texte libre | Pas d’identité, pas de réutilisation |
| `source`, `destination` | Texte | Pas de géofence, pas de multi-stations |
| `compartments[]` | Tableau de litres | Pas de barème mm→L, pas d’id compartiment |
| `tankReceipts[]` | Tableau de litres | Pas lié à une cuve réelle |
| `alertLoss` | Un seul nombre | Une alerte max, pas de lieu/heure |
| `eventLog[]` | Journal local | Non auditable, horodatage HH:mm seulement |
| `clients[]` | Constante front | Pas d’isolation des données |

Règle d’intégration : **ne pas persister le JSON UI tel quel**. Le décomposer en tables métier.

---

## 2. Décisions à figer avant le schéma

1. **Opérateur vs client**  
   Sud Contractors = `organization` racine. Chaque client (ex. Pétro Ivoire) = `tenant`. Toutes les tables métier portent `tenant_id`.

2. **Un Postgres, deux rythmes**  
   - Tables relationnelles : clients, flotte, missions, documents, utilisateurs.  
   - Hypertable Timescale : `telemetry_samples` (plus tard).  
   Pas d’Influx, pas de Mongo.

3. **Où tourne Prisma au premier branchement**  
   L’app est déjà sur Vercel. Pour l’intégration DB **sans MQTT** : Prisma + Neon (ou Supabase Postgres) **depuis Next.js** (Route Handlers).  
   NestJS + worker MQTT restent pour la phase capteurs. Le schéma Postgres est le contrat commun.

4. **Volumes**  
   Stocker **litres** (décimal) **et** `niveau_mm` quand une jauge existe. Le barème (table de conversion par cuve/citerne) est une table, pas un calcul magique dans l’UI.

5. **Tolérance d’écart**  
   Seuil par tenant (ex. 0,5 % ou N litres). Le statut « conforme / à investiguer » est **calculé**, éventuellement matérialisé à la clôture.

---

## 3. Entités (cœur métier)

```
organization (Sud Contractors)
  └── tenant (client)
        ├── users + memberships (rôles)
        ├── sites (GESTOCI, stations)
        ├── tanks (cuves, barèmes)
        ├── trucks + compartments
        ├── drivers
        ├── products (SP, gasoil…)
        ├── missions
        │     ├── loading_lines (par compartiment)
        │     ├── unloading_lines (compartiment → cuve)
        │     ├── events (journal)
        │     ├── documents
        │     └── alerts
        └── (plus tard) telemetry_samples, pump_readings
```

### 3.1 Identité & accès

| Table | Rôle |
|---|---|
| `organization` | Marque / éditeur (SC) |
| `tenant` | Espace client isolé (`code` unique, statut actif/essai) |
| `user` | Personne (email) |
| `membership` | `user` × `tenant` + rôle : `owner`, `manager`, `supervisor`, `attendant`, `driver` |
| `session` | Géré par Better Auth / Auth.js, pas à la main |

Un utilisateur SC support peut avoir un `membership` spécial `operator` **sans** voir les litres d’un tenant par défaut (impersonation explicite, journalisée).

### 3.2 Référentiel terrain

| Table | Champs clés |
|---|---|
| `site` | type `depot` \| `station`, nom, lat/lng, rayon géofence (m) |
| `tank` | `site_id`, produit, capacité L, `calibration_id` |
| `tank_calibration` | version, date, fichier barème |
| `calibration_point` | `mm`, `litres` (interpolation linéaire entre points) |
| `truck` | immat, tenant, nb compartiments max (extensible, pas figé à 12) |
| `compartment` | `truck_id`, index 1..N, capacité, calibration optionnelle |
| `driver` | lié user optionnel + pièce d’identité |
| `product` | code, nom, densité de référence (V2) |

### 3.3 Mission (remplace l’objet `Mission` du front)

Une mission = **un voyage** GESTOCI → station(s).

| Table | Contenu |
|---|---|
| `mission` | `tenant_id`, `code`, `status` (`draft`/`loading`/`transit`/`unloading`/`reconciled`/`cancelled`), truck, driver, depot, station, produit, timestamps |
| `mission_loading` | bon GESTOCI, volume certifié total, agent, `certified_at` |
| `loading_line` | `compartment_id`, litres (et mm), scellé |
| `mission_unloading` | arrivée, volume camion mesuré |
| `unloading_line` | vers `tank_id`, litres reçus |
| `mission_event` | type, payload JSON, `created_at` timestamptz, `actor_id` |
| `alert` | type (`volume_drop`, `idle`, `geofence`, `probe_lost`), mission, lat/lng, litres avant/après, `acknowledged_at` |
| `document` | type (`loading_note`, `delivery_note`, `gauge_photo`), `storage_key`, mission |

**Rapprochement** (vue ou colonnes à la clôture) :

- `loaded_l` = somme `loading_line`  
- `in_transit_min_l` = dernier sample télémétrie (ou `loaded_l - alert_loss` en simu)  
- `unloaded_l` = somme `unloading_line`  
- `gap_transit_l`, `gap_unload_l`, `gap_total_l`, `gap_pct`  
- `within_tolerance` bool

Ne pas écraser l’historique : un `mission_snapshot` à chaque changement de statut (preuve).

### 3.4 Télémétrie (phase 2, même base)

```
telemetry_sample (
  time timestamptz,
  tenant_id,
  truck_id,
  compartment_id,
  mission_id nullable,
  level_mm,
  litres,
  lat, lng,
  rssi,
  source  -- mqtt | manual | sim
)
```

Hypertable Timescale sur `time`. Index `(mission_id, time desc)`, `(truck_id, time desc)`.

Règle d’alerte **hors base ou en job** : si Δ litres > seuil **et** point hors géofence depot/station → insert `alert`.

---

## 4. Mapping UI actuelle → tables

| Écran / action | Écriture DB |
|---|---|
| Sélecteur client | `SET tenant` via membership, jamais un `select` libre en prod |
| Certifier chargement | `mission.status=transit` + `loading_line` + event |
| Simuler une perte | `alert` + event + (phase 2) samples. Flag `source=sim` obligatoire |
| Confirmer arrivée | `mission_unloading.arrived_at` + volume camion |
| Saisie cuves | `unloading_line` |
| Clôturer | status `reconciled`, snapshot, calcul écarts |
| Recommencer | **nouvelle** mission, ne pas muter l’ancienne |
| Portail clients | CRUD `tenant` côté opérateur SC uniquement |

---

## 5. Isolation & sécurité

- RLS Postgres : `tenant_id = current_setting('app.tenant_id')` (ou policies Supabase).  
- L’API pose le tenant **après** auth, jamais depuis le body seul.  
- Les litres et GPS sont des données sensibles : pas de log brut des payloads.  
- Soft delete (`deleted_at`) sur référentiel ; missions clôturées immuables.

---

## 6. Ce qu’on ne met **pas** en base

- Position camion interpolée pour l’UI (dérivée des samples).  
- « Conforme » comme vérité unique sans les volumes sources.  
- Fichiers PDF/photos en BYTEA : objet S3/R2 + `document.storage_key`.  
- Sessions JWT.  
- Compteurs pompes **dans** `mission` (autre agrégat journalier `pump_reading`).

---

## 7. Plan d’intégration (sans casser la démo)

**Étape A — Schéma + seed**  
Prisma : tenant démo PID-CI, 1 station, 1 camion 7 compartiments, 2 cuves, 1 user. Seed = scénario actuel 45 000 L.

**Étape B — API mission**  
`GET/POST /api/missions`, `POST .../certify-loading`, `.../simulate-loss`, `.../arrive`, `.../unload`, `.../close`.  
Le front ne calcule plus les totaux métier : il affiche la réponse serveur.

**Étape C — Auth**  
Login réel, header tenant, disparition du faux sélecteur « tout le monde voit tout ».

**Étape D — Dual write (option courte)**  
Écrire DB **et** localStorage 2 sprints, feature flag `USE_DB`. Rollback démo Vercel = flag off.

**Étape E — Timescale**  
Worker MQTT. L’UI live lit les derniers samples, plus un `alertLoss` magique.

Hébergement DB recommandé avec Vercel : **Neon** (Postgres 16, branche preview par PR). Timescale : instance dédiée plus tard **ou** Neon + table normale tant que le volume de samples reste faible (2 camions).

---

## 8. Risques

| Risque | Mitigation |
|---|---|
| Recoller le JSON mission dans une colonne `jsonb` | Interdit pour volumes ; jsonb OK seulement pour payload d’event |
| Oublier le tenant sur une table | Checklist : toute table métier a `tenant_id` + index |
| Arrondi litres | `numeric(12,3)` pas `float` |
| Deux sources de vérité (UI vs DB) | Serveur source ; UI read-only sur totaux |
| Vercel timeout vs MQTT | Ne pas coller le broker dans les Route Handlers |
| Simulation prise pour de la télémétrie | `source=sim` + alerte visible « démo » |

---

## 9. Questions ouvertes (bloquent le DDL)

1. Un tenant = une société cliente ; un utilisateur peut-il appartenir à plusieurs tenants ?  
2. Une mission peut-elle dépoter sur **plusieurs** stations ? (schéma `unloading_line.site_id` ou 1 destination)  
3. Les camions sont-ils **propriétaires du client** ou flotte SC affrétée ? (FK tenant vs organization)  
4. Unité légale : litres observés vs litres à 15 °C dès le MVP ?  
5. Conservation : 12 mois ? 24 mois ? (purge Timescale)  
6. Qui crée le barème : SC à l’installation, ou le superviseur station ?

---

## 10. Premier livrable technique (quand on code)

1. `prisma/schema.prisma` (tables §3 sans telemetry).  
2. Migration + seed PID-CI.  
3. Remplacer `setMission` local par appels API pour **une** mission.  
4. Garder l’UI actuelle ; aucun écran Figma.

Tant que 1–3 du §2 et les questions §9 ne sont pas tranchées, on ne fige pas les UUID vs codes métier (`SC-260925-01`).
