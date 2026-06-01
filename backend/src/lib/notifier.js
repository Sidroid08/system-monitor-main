import nodemailer from 'nodemailer';
import prisma from './prisma.js';
import { env } from '../config/env.js';

// ─── Transport helpers ────────────────────────────────────────────────────────

function getEmailTransport() {
  if (!env.smtp.host) return null;
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

const SEVERITY_EMOJI = { LOW: '🟡', MEDIUM: '🟠', HIGH: '🔴', CRITICAL: '🚨' };

function formatAlertBody(alert, rule) {
  const emoji = SEVERITY_EMOJI[alert.severity] ?? '⚠️';
  return {
    subject: `${emoji} [${alert.severity}] ${alert.title}`,
    text: [
      `Alert: ${alert.title}`,
      alert.description ? `Description: ${alert.description}` : null,
      `Severity: ${alert.severity}`,
      rule?.promql ? `Expression: ${rule.promql}` : null,
      `Triggered at: ${alert.triggeredAt.toISOString()}`,
      alert.labels ? `Labels: ${alert.labels}` : null,
    ].filter(Boolean).join('\n'),
    html: [
      `<h2>${emoji} ${alert.title}</h2>`,
      alert.description ? `<p>${alert.description}</p>` : '',
      `<table>`,
      `<tr><td><b>Severity</b></td><td>${alert.severity}</td></tr>`,
      rule?.promql ? `<tr><td><b>Expression</b></td><td><code>${rule.promql}</code></td></tr>` : '',
      alert.labels ? `<tr><td><b>Labels</b></td><td><code>${alert.labels}</code></td></tr>` : '',
      `<tr><td><b>Triggered</b></td><td>${alert.triggeredAt.toISOString()}</td></tr>`,
      `</table>`,
    ].join(''),
  };
}

// ─── Per-channel delivery ─────────────────────────────────────────────────────

async function sendEmail(config, alert, rule) {
  const transport = getEmailTransport();
  if (!transport) return;

  const { subject, text, html } = formatAlertBody(alert, rule);
  await transport.sendMail({
    from: env.smtp.from,
    to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
    subject,
    text,
    html,
  });
}

async function sendSlack(config, alert, rule) {
  if (!config.webhookUrl) return;

  const emoji = SEVERITY_EMOJI[alert.severity] ?? '⚠️';
  const body = {
    text: `${emoji} *[${alert.severity}] ${alert.title}*`,
    attachments: [
      {
        color: alert.severity === 'CRITICAL' ? '#FF0000'
          : alert.severity === 'HIGH' ? '#FF6600'
          : alert.severity === 'MEDIUM' ? '#FFAA00' : '#FFDD00',
        fields: [
          alert.description && { title: 'Description', value: alert.description, short: false },
          rule?.promql && { title: 'Expression', value: `\`${rule.promql}\``, short: false },
          alert.labels && { title: 'Labels', value: `\`${alert.labels}\``, short: false },
          { title: 'Triggered', value: alert.triggeredAt.toISOString(), short: true },
        ].filter(Boolean),
      },
    ],
  };

  const res = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }
}

async function sendWebhook(config, alert, rule) {
  if (!config.url) return;

  const payload = {
    alert: {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      triggeredAt: alert.triggeredAt,
      description: alert.description,
      labels: alert.labels ? JSON.parse(alert.labels) : null,
    },
    rule: rule ? { id: rule.id, name: rule.name, promql: rule.promql } : null,
  };

  const res = await fetch(config.url, {
    method: config.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(config.headers ?? {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}`);
  }
}

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function severityGte(alertSeverity, minSeverity) {
  return SEVERITY_ORDER.indexOf(alertSeverity) >= SEVERITY_ORDER.indexOf(minSeverity);
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Called by the evaluator after a new Alert is created.
// Loads active channels for the org and dispatches to each.
export async function dispatchAlert(alert, rule) {
  const channels = await prisma.notificationChannel.findMany({
    where: { organizationId: alert.organizationId, isActive: true },
  });

  await Promise.allSettled(
    channels
      .filter((ch) => severityGte(alert.severity, ch.minSeverity))
      .map(async (channel) => {
        let config;
        try {
          config = JSON.parse(channel.config);
        } catch {
          return;
        }

        switch (channel.type) {
          case 'EMAIL':   return sendEmail(config, alert, rule);
          case 'SLACK':   return sendSlack(config, alert, rule);
          case 'WEBHOOK': return sendWebhook(config, alert, rule);
        }
      }),
  );
}
