import { PrismaClient } from "@prisma/client";
import { ensureDemoData } from "../lib/seed-demo";

const prisma = new PrismaClient();

async function main() {
  await prisma.alert.deleteMany();
  await prisma.missionEvent.deleteMany();
  await prisma.loadingLine.deleteMany();
  await prisma.unloadingLine.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.tank.deleteMany();
  await prisma.compartment.deleteMany();
  await prisma.truck.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.product.deleteMany();
  await prisma.site.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.organization.deleteMany();
  await ensureDemoData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
