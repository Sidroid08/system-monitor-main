import "dotenv/config";
import prisma from "./lib/prisma.js";

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log("Prisma connected successfully");
  console.log("Organizations:", orgs);
}

main()
  .catch((err) => {
    console.error("Prisma error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });