import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Prisma connected successfully');
  console.log('Organization count:', orgs.length);
}

main()
  .catch((err) => {
    console.error('Prisma error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
