# Proposition de stack — à valider avant développement

Produit : traçabilité carburant GESTOCI → trajet → station (sondes, alertes, multi-sites).

Cette note est **la décision à trancher**. Les mockups (`mockups/index.html`) illustrent l’UI ; ils ne figent pas encore le code.

---

## Principe

- **Un langage partout** : TypeScript (web, API, scripts).
- **Un backend** : API HTTP + ingestion MQTT (IoT).
- **Pas d’app native au MVP** : web responsive + PWA (pompiste / chauffeur / gérant).
- **Postgres unique** : métier + séries temporelles (extension Timescale).
- Le hardware (sondes, ATEX, 4G) est **hors stack logicielle** mais l’interface d’ingestion MQTT fait partie du contrat.

---

## Stack proposée (MVP)

| Couche | Choix | Pourquoi |
|---|---|---|
| Web / PWA | **Next.js 15** (App Router) + TypeScript | Dashboards, auth, cartes, saisie mobile, un seul déploiement. |
| UI | **Tailwind CSS** + **shadcn/ui** | Prototypes → prod sans refonte. |
| Cartes | **Leaflet** + tuiles OSM | Gratuit, suffisant pour 2 camions + géofences. |
| Temps réel UI | **WebSocket** (Socket.IO ou native Nest) | Niveaux citerne / cuves + alertes live. |
| API | **NestJS** + TypeScript | Modules (missions, IoT, stations, rôles), validation, WebSocket. |
| IoT | **MQTT** (**EMQX** ou Mosquitto) TLS | Standard sondes / gateway 4G. |
| Base | **PostgreSQL 16** + **TimescaleDB** | Users, missions, barèmes + mesures `mm`/`litres` haute fréquence. |
| Cache / files | **Redis** | Sessions, pub/sub alertes, anti-doublon MQTT. |
| ORM | **Prisma** | Schéma lisible, migrations, types TS. |
| Auth | **Better Auth** (ou Auth.js) + rôles en base | Dirigeant, gérant, superviseur, pompiste, chauffeur. Multi-stations. |
| Fichiers | **S3 compatible** (MinIO en local, R2/S3 en prod) | Bons GESTOCI, photos jauge / index. |
| App mobile MVP | **PWA** (installable, caméra, GPS navigateur) | Évite React Native tant qu’il y a 2 camions. |
| Conteneurs | **Docker Compose** | API + Postgres + Redis + EMQX + MinIO. |
| Hébergement cible | VPS (Abidjan / Europe) + 4G gateways | Latence CI, pas de lock-in cloud obligatoire. |

### Ingestion capteurs (contrat, pas le fournisseur de sonde)

```
Sonde / gateway  --MQTT/TLS-->  EMQX  -->  NestJS (worker)  -->  Timescale
                                                      |
                                                      +--> Redis pub/sub --> WebSocket UI
                                                      +--> règles d’alerte (géofence, Δ litres)
```

Payload minimal : `camionId`, `compartimentId`, `niveauMm`, `litres`, `lat`, `lng`, `ts`, `rssi`.

---

## Hors MVP (volontairement)

| Sujet | Plus tard | Raison |
|---|---|---|
| React Native / Expo | V2 chauffeur | PWA suffit pour identifier + photo + suivi. |
| Mapbox payant | Si tuiles OSM insuffisantes | Coût. |
| Kafka | Non | Volume : 2 camions, 2–3 livraisons / semaine / station. |
| Microservices | Non | Une API NestJS. |
| Kubernetes | Non | Compose / un VPS. |
| Firebase | Non | Données métier + IoT mieux en Postgres. |
| Compensation 15 °C auto | V2 | Besoin capteur température calibré. |

---

## Alternatives écartées

- **Flutter partout** : bon pour mobile, plus lent pour un back-office dense (tableaux, rôles, docs).
- **Python FastAPI** : excellent IoT, mais deux langages (web TS + API Python) pour une petite équipe.
- **Supabase seul** : auth/storage rapides, MQTT + règles d’alerte « fraude hors station » moins naturels.
- **MongoDB** : les barèmes mm→litres et les rapprochements sont relationnels.

---

## Décisions à valider (oui / non)

Cochez avant d’écrire du code métier :

1. **Next.js + NestJS + Postgres/Timescale + MQTT (EMQX) + Redis + PWA** comme socle MVP.
2. **Pas d’app native** au MVP.
3. **Leaflet / OSM**, pas Mapbox.
4. **Un seul Postgres** (pas Influx séparé).
5. Hardware : stack logicielle **agnostique** (MQTT) ; choix des sondes en parallèle, pas bloquant pour démarrer l’API + mockups.

Si 1–4 sont OK, le développement peut commencer sur cette stack. Les mockups restent la maquette UX, indépendante du hardware.
