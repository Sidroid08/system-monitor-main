import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rules = await prisma.alertRule.findMany({ include: { organization: true } });
  console.log(JSON.stringify(rules, null, 2));
}
main().finally(() => prisma.$disconnect());
