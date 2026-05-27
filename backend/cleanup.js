import prisma from './src/lib/prisma.js';
import axios from 'axios';
import { clearCooldown } from './src/workers/alertEvaluator.js';

const GRAFANA_URL = process.env.INTERNAL_GRAFANA_URL || 'http://localhost:8769';
const GRAFANA_AUTH = Buffer.from('admin:admin123').toString('base64');

const grafana = axios.create({
  baseURL: GRAFANA_URL,
  headers: {
    Authorization: `Basic ${GRAFANA_AUTH}`,
    'Content-Type': 'application/json',
    'X-Disable-Provenance': 'true',
  },
  timeout: 10000,
});

async function run() {
  const email = 'harshagarwal19696@gmail.com';
  console.log(`Starting cleanup for user: ${email}`);

  // Find user and their org
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true }
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  const orgId = user.organizationId;
  console.log(`Found user in org: ${orgId}`);

  // 1. Delete all their Alert Rules
  const rules = await prisma.alertRule.findMany({
    where: { organizationId: orgId }
  });

  for (const rule of rules) {
    console.log(`Deleting alert rule: ${rule.id}`);
    
    // Clear cooldown
    clearCooldown(rule.id);

    // Delete from Grafana
    if (rule.grafanaRuleUid) {
      try {
        await grafana.delete(`/api/v1/provisioning/alert-rules/${rule.grafanaRuleUid}`);
        console.log(`- Deleted Grafana rule`);
      } catch (e) {
        console.log(`- Failed to delete Grafana rule: ${e.message}`);
      }
    }

    if (rule.grafanaContactUid) {
      try {
        await grafana.delete(`/api/v1/provisioning/contact-points/${rule.grafanaContactUid}`);
        console.log(`- Deleted Grafana contact point`);
      } catch (e) {
        console.log(`- Failed to delete Grafana contact point: ${e.message}`);
      }
    }

    // Delete from DB
    await prisma.alertRule.delete({ where: { id: rule.id } });
    console.log(`- Deleted from DB`);
  }

  // 2. Delete all their instances
  const instances = await prisma.monitoredInstance.findMany({
    where: { organizationId: orgId }
  });

  for (const inst of instances) {
    console.log(`Deleting instance: ${inst.id}`);
    await prisma.monitoredInstance.delete({ where: { id: inst.id } });
  }

  console.log('Cleanup complete!');
}

run().catch(console.error);
