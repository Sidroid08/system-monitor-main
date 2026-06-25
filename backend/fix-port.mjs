import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const instances = await prisma.monitoredInstance.findMany({
    where: { organizationId: 'ff58fa0f-af07-4b7c-97a6-3492204a1383' },
    select: { id: true, instanceName: true, privateIp: true, exporterPort: true }
  });

  console.log('Current instances:', JSON.stringify(instances, null, 2));

  // Update all Windows instances (or those using the wrong port) to port 9200
  for (const inst of instances) {
    if (inst.exporterPort !== 9200) {
      await prisma.monitoredInstance.update({
        where: { id: inst.id },
        data: { exporterPort: 9200 }
      });
      console.log(`Updated ${inst.instanceName || inst.privateIp}: ${inst.exporterPort} -> 9200`);
    } else {
      console.log(`${inst.instanceName || inst.privateIp} already on 9200, skipping`);
    }
  }

  const updated = await prisma.monitoredInstance.findMany({
    where: { organizationId: 'ff58fa0f-af07-4b7c-97a6-3492204a1383' },
    select: { id: true, instanceName: true, privateIp: true, exporterPort: true }
  });
  console.log('After update:', JSON.stringify(updated, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
