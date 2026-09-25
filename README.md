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
- sauvegarde de la mission dans le navigateur.

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
[`docs/STACK.md`](docs/STACK.md). L’application web est déployable sur Vercel ;
le futur broker MQTT et le worker d’ingestion IoT resteront sur un service
persistant séparé.
