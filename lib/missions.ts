import { prisma } from "./prisma";
import { ensureDemoData } from "./seed-demo";

export type MissionDTO = {
  id: string;
  stage: "draft" | "transit" | "unloading" | "completed";
  missionId: string;
  truck: string;
  driver: string;
  source: string;
  destination: string;
  product: string;
  compartments: number[];
  tankReceipts: number[];
  eventLog: {
    label: string;
    detail: string;
    time: string;
    status: "done" | "alert" | "pending";
  }[];
  alertLoss: number;
};

export type TenantDTO = {
  name: string;
  code: string;
  stations: number;
  trucks: number;
  status: string;
};

const missionInclude = {
  truck: { include: { compartments: { orderBy: { index: "asc" as const } } } },
  driver: true,
  depot: true,
  station: true,
  product: true,
  loadingLines: { include: { compartment: true } },
  unloadingLines: { include: { tank: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.MissionInclude;

type MissionRecord = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;

const toNumber = (value: Prisma.Decimal | number) => Number(value);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

export function serializeMission(mission: MissionRecord): MissionDTO {
  const compartments = [...mission.truck.compartments]
    .sort((a, b) => a.index - b.index)
    .map((compartment) => {
      const line = mission.loadingLines.find(
        (item) => item.compartmentId === compartment.id,
      );
      return line ? toNumber(line.litres) : toNumber(compartment.capacityL);
    });

  const tankReceipts = [...mission.unloadingLines]
    .sort((a, b) => a.tank.name.localeCompare(b.tank.name))
    .map((line) => toNumber(line.litres));

  return {
    id: mission.id,
    stage: mission.status as MissionDTO["stage"],
    missionId: mission.code,
    truck: mission.truck.plate,
    driver: mission.driver.name,
    source: mission.depot.name,
    destination: mission.station.name,
    product: mission.product.name,
    compartments,
    tankReceipts,
    alertLoss: toNumber(mission.alertLossL),
    eventLog: mission.events.map((event) => ({
      label: event.label,
      detail: event.detail,
      time: formatTime(event.createdAt),
      status: event.status as MissionDTO["eventLog"][number]["status"],
    })),
  };
}

export async function listTenants(): Promise<TenantDTO[]> {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: { select: { trucks: true } },
      sites: { where: { type: "station" } },
    },
    orderBy: { name: "asc" },
  });

  return tenants.map((tenant) => ({
    name: tenant.name,
    code: tenant.code,
    stations: tenant.sites.length,
    trucks: tenant._count.trucks,
    status: tenant.status === "active" ? "Actif" : "Essai",
  }));
}

export async function getCurrentMission(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { code: tenantCode },
  });
  if (!tenant) return null;

  const mission = await prisma.mission.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    include: missionInclude,
  });

  return mission ? serializeMission(mission) : null;
}

async function addEvent(
  missionId: string,
  type: string,
  label: string,
  detail: string,
  status: "done" | "alert" | "pending" = "done",
) {
  return prisma.missionEvent.create({
    data: { missionId, type, label, detail, status },
  });
}

export async function saveCompartments(missionId: string, litres: number[]) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: { truck: { include: { compartments: { orderBy: { index: "asc" } } } } },
  });

  if (mission.status !== "draft") {
    throw new Error("Les compartiments ne peuvent plus être modifiés.");
  }

  await prisma.$transaction(
    mission.truck.compartments.map((compartment, index) =>
      prisma.loadingLine.upsert({
        where: {
          missionId_compartmentId: {
            missionId,
            compartmentId: compartment.id,
          },
        },
        update: { litres: litres[index] ?? 0 },
        create: {
          missionId,
          compartmentId: compartment.id,
          litres: litres[index] ?? 0,
        },
      }),
    ),
  );

  const loaded = litres.reduce((sum, value) => sum + (value || 0), 0);
  await prisma.mission.update({
    where: { id: missionId },
    data: { loadedL: loaded, inTruckL: loaded },
  });

  return getMissionById(missionId);
}

export async function certifyLoading(missionId: string) {
  const mission = await getMissionById(missionId);
  const loaded = mission.compartments.reduce((sum, value) => sum + value, 0);
  if (!loaded) throw new Error("Volume chargé vide.");

  await prisma.mission.update({
    where: { id: missionId },
    data: {
      status: "transit",
      loadedL: loaded,
      inTruckL: loaded,
      certifiedAt: new Date(),
    },
  });
  await addEvent(
    missionId,
    "loading_certified",
    "Chargement certifié",
    `${loaded.toLocaleString("fr-FR")} L répartis dans ${mission.compartments.length} compartiments`,
  );
  await addEvent(
    missionId,
    "departure",
    "Départ de GESTOCI",
    "Scellés contrôlés · télémétrie active",
  );
  return getMissionById(missionId);
}

export async function simulateLoss(missionId: string) {
  const current = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
  });
  if (Number(current.alertLossL) > 0) return getMissionById(missionId);

  const loss = 620;
  await prisma.mission.update({
    where: { id: missionId },
    data: {
      alertLossL: loss,
      inTruckL: Number(current.loadedL) - loss,
      gapTransitL: loss,
    },
  });
  await prisma.alert.create({
    data: {
      tenantId: current.tenantId,
      missionId,
      type: "volume_drop",
      litres: loss,
      source: "sim",
    },
  });
  await addEvent(
    missionId,
    "volume_drop",
    "Variation hors zone autorisée",
    "−620 L · compartiment 3 · arrêt de 12 min au km 42",
    "alert",
  );
  return getMissionById(missionId);
}

export async function arriveAtStation(missionId: string) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: {
      station: { include: { tanks: { orderBy: { name: "asc" } } } },
    },
  });
  const inTruck = Number(mission.inTruckL);
  const first = Math.round(inTruck * 0.54);
  const tanks = mission.station.tanks;
  if (tanks.length < 2) throw new Error("Deux cuves sont requises.");

  await prisma.$transaction([
    prisma.unloadingLine.upsert({
      where: { missionId_tankId: { missionId, tankId: tanks[0].id } },
      update: { litres: first },
      create: { missionId, tankId: tanks[0].id, litres: first },
    }),
    prisma.unloadingLine.upsert({
      where: { missionId_tankId: { missionId, tankId: tanks[1].id } },
      update: { litres: inTruck - first },
      create: { missionId, tankId: tanks[1].id, litres: inTruck - first },
    }),
    prisma.mission.update({
      where: { id: missionId },
      data: {
        status: "unloading",
        arrivedAt: new Date(),
        unloadedL: inTruck,
      },
    }),
  ]);
  await addEvent(
    missionId,
    "arrival",
    "Arrivée à la station",
    `${inTruck.toLocaleString("fr-FR")} L mesurés avant déversement`,
  );
  return getMissionById(missionId);
}

export async function saveReceipts(missionId: string, litres: number[]) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: {
      station: { include: { tanks: { orderBy: { name: "asc" } } } },
    },
  });
  if (mission.status !== "unloading") {
    throw new Error("Le déversement n’est pas ouvert.");
  }

  const tanks = mission.station.tanks;
  const unloaded = litres.reduce((sum, value) => sum + (value || 0), 0);
  await prisma.$transaction([
    ...tanks.map((tank, index) =>
      prisma.unloadingLine.upsert({
        where: { missionId_tankId: { missionId, tankId: tank.id } },
        update: { litres: litres[index] ?? 0 },
        create: { missionId, tankId: tank.id, litres: litres[index] ?? 0 },
      }),
    ),
    prisma.mission.update({
      where: { id: missionId },
      data: { unloadedL: unloaded },
    }),
  ]);
  return getMissionById(missionId);
}

export async function closeMission(missionId: string) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: { tenant: true, unloadingLines: true },
  });
  const loaded = Number(mission.loadedL);
  const inTruck = Number(mission.inTruckL);
  const unloaded = mission.unloadingLines.reduce(
    (sum, line) => sum + Number(line.litres),
    0,
  );
  const gapTransit = Number(mission.alertLossL);
  const gapUnload = inTruck - unloaded;
  const gapTotal = loaded - unloaded;
  const gapPercent = loaded ? (gapTotal / loaded) * 100 : 0;
  const tolerance = Number(mission.tenant.gapTolerancePercent);
  const withinTolerance = Math.abs(gapPercent) <= tolerance;

  await prisma.mission.update({
    where: { id: missionId },
    data: {
      status: "completed",
      unloadedL: unloaded,
      gapTransitL: gapTransit,
      gapUnloadL: gapUnload,
      gapTotalL: gapTotal,
      gapPercent,
      withinTolerance,
      closedAt: new Date(),
    },
  });
  await addEvent(
    missionId,
    "unloaded",
    "Déversement terminé",
    `${unloaded.toLocaleString("fr-FR")} L reçus dans les cuves de la station`,
  );
  await addEvent(
    missionId,
    "reconciled",
    "Rapprochement généré",
    `Écart total : ${gapTotal.toLocaleString("fr-FR")} L (${gapPercent.toFixed(2)} %)`,
    withinTolerance ? "done" : "alert",
  );
  return getMissionById(missionId);
}

export async function resetMission(tenantCode: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { code: tenantCode },
    include: {
      trucks: { include: { compartments: { orderBy: { index: "asc" } } } },
      drivers: true,
      products: true,
      sites: true,
    },
  });
  const truck = tenant.trucks[0];
  const driver = tenant.drivers[0];
  const product = tenant.products[0];
  const depot = tenant.sites.find((site) => site.type === "depot");
  const station = tenant.sites.find((site) => site.type === "station");
  if (!truck || !driver || !product || !depot || !station) {
    throw new Error("Référentiel tenant incomplet.");
  }

  const code = `SC-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(
    (await prisma.mission.count({ where: { tenantId: tenant.id } })) + 1,
  ).padStart(2, "0")}`;

  const created = await prisma.mission.create({
    data: {
      tenantId: tenant.id,
      code,
      status: "draft",
      truckId: truck.id,
      driverId: driver.id,
      depotId: depot.id,
      stationId: station.id,
      productId: product.id,
      loadingNote: "GESTOCI-BL-88241",
      loadedL: 45000,
      inTruckL: 45000,
      loadingLines: {
        create: truck.compartments.map((compartment) => ({
          compartmentId: compartment.id,
          litres: compartment.capacityL,
        })),
      },
      events: {
        create: {
          type: "created",
          label: "Mission créée",
          detail: `Ordre de transport affecté au camion ${truck.plate}`,
          status: "done",
        },
      },
    },
  });

  return getMissionById(created.id);
}

export async function getMissionById(id: string) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id },
    include: missionInclude,
  });
  return serializeMission(mission);
}

export async function checkDatabase() {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
  const seed = await ensureDemoData();
  const counts = await prisma.$transaction([
    prisma.tenant.count(),
    prisma.mission.count(),
  ]);
  return {
    connected: rows[0]?.ok === 1,
    seeded: seed.seeded,
    tenants: counts[0],
    missions: counts[1],
  };
}
