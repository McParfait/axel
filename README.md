# ProFuel — Sud Contractors

Prototype fonctionnel de traçabilité du carburant, du chargement GESTOCI
jusqu’au déversement dans les cuves de station.

## Fonctionnalités du prototype

- identité visuelle Sud Contractors ;
- portail multi-clients ;
- chargement par compartiment ;
- trajet et télémétrie simulée ;
- simulation d’une perte hors géofence ;
- déversement dans les cuves ;
- rapprochement automatique et journal horodaté ;
- sauvegarde de la mission dans Postgres Neon (Vercel)
- endpoint `/api/health` pour vérifier la connexion

## Base de données

L’intégration Neon est branchée via les variables Vercel `DATABASE_URL` et
`DATABASE_URL_UNPOOLED`. Le schéma Prisma est dans `prisma/schema.prisma`.
Le build de production exécute `prisma migrate deploy` puis initialise les
données de démonstration au premier appel de `/api/health`.

## Lancer localement

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Vérifications

```bash
npm run lint
npm run build
```

La proposition d’architecture complète est documentée dans
[`docs/STACK.md`](docs/STACK.md). La préparation du modèle de données (sortie
de `localStorage` vers Postgres multi-tenant) est dans
[`docs/DATABASE.md`](docs/DATABASE.md).

L’application web est déployable sur Vercel ; le futur broker MQTT et le
worker d’ingestion IoT resteront sur un service persistant séparé.
