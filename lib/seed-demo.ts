import { prisma } from "./prisma";

export async function ensureDemoData() {
  const existing = await prisma.tenant.count();
  if (existing > 0) return { seeded: false, tenants: existing };

  const organization = await prisma.organization.create({
    data: { name: "Sud Contractors" },
  });

  const pid = await prisma.tenant.create({
    data: {
      organizationId: organization.id,
      code: "PID-CI",
      name: "Pétro Ivoire Distribution",
      status: "active",
      gapTolerancePercent: 0.5,
    },
  });

  const demo = await prisma.tenant.create({
    data: {
      organizationId: organization.id,
      code: "DEMO-01",
      name: "Client démonstration",
      status: "trial",
      gapTolerancePercent: 0.5,
    },
  });

  const demoDepot = await prisma.site.create({
    data: { tenantId: demo.id, type: "depot", name: "Dépôt GESTOCI — Vridi" },
  });
  const demoStation = await prisma.site.create({
    data: { tenantId: demo.id, type: "station", name: "Station démonstration" },
  });
  const demoProduct = await prisma.product.create({
    data: { tenantId: demo.id, code: "GO", name: "Gasoil" },
  });
  const demoDriver = await prisma.driver.create({
    data: { tenantId: demo.id, name: "Chauffeur démo" },
  });
  const demoTruck = await prisma.truck.create({
    data: {
      tenantId: demo.id,
      plate: "CI-1001-DEMO",
      compartments: { create: [{ index: 1, capacityL: 20000 }] },
    },
    include: { compartments: true },
  });
  await prisma.tank.createMany({
    data: [
      {
        tenantId: demo.id,
        siteId: demoStation.id,
        productId: demoProduct.id,
        name: "Cuve 1",
        capacityL: 20000,
      },
      {
        tenantId: demo.id,
        siteId: demoStation.id,
        productId: demoProduct.id,
        name: "Cuve 2",
        capacityL: 20000,
      },
    ],
  });
  await prisma.mission.create({
    data: {
      tenantId: demo.id,
      code: "SC-DEMO-01",
      status: "draft",
      truckId: demoTruck.id,
      driverId: demoDriver.id,
      depotId: demoDepot.id,
      stationId: demoStation.id,
      productId: demoProduct.id,
      loadedL: 20000,
      inTruckL: 20000,
      loadingLines: {
        create: {
          compartmentId: demoTruck.compartments[0].id,
          litres: 20000,
        },
      },
      events: {
        create: {
          type: "created",
          label: "Mission créée",
          detail: "Espace de démonstration",
          status: "done",
        },
      },
    },
  });

  const depot = await prisma.site.create({
    data: {
      tenantId: pid.id,
      type: "depot",
      name: "Dépôt GESTOCI — Vridi",
      latitude: 5.244,
      longitude: -4.01,
      geofenceMeters: 400,
    },
  });
  const station = await prisma.site.create({
    data: {
      tenantId: pid.id,
      type: "station",
      name: "Station Cocody Angré",
      latitude: 5.392,
      longitude: -3.976,
      geofenceMeters: 180,
    },
  });
  const gasoil = await prisma.product.create({
    data: { tenantId: pid.id, code: "GO", name: "Gasoil" },
  });
  const driver = await prisma.driver.create({
    data: { tenantId: pid.id, name: "Kouamé Diabaté" },
  });
  const truck = await prisma.truck.create({
    data: {
      tenantId: pid.id,
      plate: "CI-4421-AB",
      compartments: {
        create: [1, 2, 3, 4, 5, 6].map((index) => ({
          index,
          capacityL: 6500,
        })).concat([{ index: 7, capacityL: 6000 }]),
      },
    },
    include: { compartments: { orderBy: { index: "asc" } } },
  });
  await prisma.tank.createMany({
    data: [
      {
        tenantId: pid.id,
        siteId: station.id,
        productId: gasoil.id,
        name: "Cuve 1",
        capacityL: 30000,
      },
      {
        tenantId: pid.id,
        siteId: station.id,
        productId: gasoil.id,
        name: "Cuve 2",
        capacityL: 30000,
      },
    ],
  });
  await prisma.mission.create({
    data: {
      tenantId: pid.id,
      code: "SC-260925-01",
      status: "draft",
      truckId: truck.id,
      driverId: driver.id,
      depotId: depot.id,
      stationId: station.id,
      productId: gasoil.id,
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
          detail: "Ordre de transport affecté au camion CI-4421-AB",
          status: "done",
        },
      },
    },
  });

  return { seeded: true, tenants: 2 };
}
