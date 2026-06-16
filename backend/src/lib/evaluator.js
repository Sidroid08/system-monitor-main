import prisma from './prisma.js';
import { queryInstant } from './vmClient.js';
import { dispatchAlert } from './notifier.js';

let evaluationIntervalMs = 30_000;

function normalizeIntervalSeconds(intervalSeconds) {
  const seconds = Number(intervalSeconds ?? 30);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 30;
  }
  return Math.max(1, Math.floor(seconds));
}

// ─── Condition evaluation ─────────────────────────────────────────────────────

function meetsCondition(value, condition, threshold) {
  switch (condition) {
    case 'GT':  return value > threshold;
    case 'GTE': return value >= threshold;
    case 'LT':  return value < threshold;
    case 'LTE': return value <= threshold;
    case 'EQ':  return value === threshold;
    default:    return false;
  }
}

// Extract a scalar from a VictoriaMetrics instant query response.
// Returns { firing: boolean, value: number|null, labels: object|null }
function extractResult(vmResult) {
  const result = vmResult?.data?.result;
  if (!Array.isArray(result) || result.length === 0) {
    return { firing: false, value: null, labels: null };
  }

  // Take the first series (rules should target a single scalar).
  const series = result[0];
  const rawValue = parseFloat(series?.value?.[1]);
  return {
    value: isNaN(rawValue) ? null : rawValue,
    labels: series?.metric ?? null,
  };
}

// ─── Per-rule evaluation ──────────────────────────────────────────────────────

async function evaluateRule(rule) {
  let vmResult;
  try {
    vmResult = await queryInstant(rule.organizationId, rule.promql);
  } catch {
    // VictoriaMetrics unavailable or bad PromQL — skip this cycle, don't change state.
    return;
  }

  const { value, labels } = extractResult(vmResult);
  const conditionMet = value !== null && meetsCondition(value, rule.condition, rule.threshold);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.alertRule.findUnique({ where: { id: rule.id } });
    if (!fresh || !fresh.isActive) return;

    if (conditionMet) {
      if (fresh.state === 'INACTIVE') {
        // Condition just started — enter PENDING state.
        await tx.alertRule.update({
          where: { id: rule.id },
          data: { state: 'PENDING', pendingSince: now, lastEvaluatedAt: now },
        });
      } else if (fresh.state === 'PENDING') {
        // Check if we've been pending long enough to fire.
        const pendingCycles = fresh.pendingSince
          ? Math.floor((now - fresh.pendingSince) / evaluationIntervalMs) + 1
          : 1;

        if (pendingCycles >= fresh.forCycles) {
          // Fire: create Alert and notify.
          const alert = await tx.alert.create({
            data: {
              organizationId: rule.organizationId,
              ruleId: rule.id,
              title: rule.name,
              description: rule.description ?? undefined,
              severity: rule.severity,
              source: 'alert-rule-engine',
              metricName: rule.promql,
              labels: labels ? JSON.stringify(labels) : null,
              status: 'OPEN',
            },
          });

          await tx.alertRule.update({
            where: { id: rule.id },
            data: { state: 'FIRING', lastFiredAt: now, lastEvaluatedAt: now },
          });

          // Dispatch notifications outside the transaction (non-blocking).
          setImmediate(() => dispatchAlert(alert, rule).catch(() => {}));
        }
      }
      // If already FIRING, nothing to do — alert stays open.
    } else {
      if (fresh.state === 'FIRING') {
        // Condition cleared — resolve open alerts for this rule.
        await tx.alert.updateMany({
          where: { ruleId: rule.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
          data: { status: 'RESOLVED', resolvedAt: now },
        });
        await tx.alertRule.update({
          where: { id: rule.id },
          data: { state: 'INACTIVE', pendingSince: null, lastEvaluatedAt: now },
        });
      } else if (fresh.state !== 'INACTIVE') {
        // Was PENDING but condition cleared before firing — reset.
        await tx.alertRule.update({
          where: { id: rule.id },
          data: { state: 'INACTIVE', pendingSince: null, lastEvaluatedAt: now },
        });
      }
    }
  });
}

// ─── Main evaluation loop ─────────────────────────────────────────────────────

async function runEvaluationCycle() {
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
    select: {
      id: true, organizationId: true, name: true, description: true,
      promql: true, condition: true, threshold: true, forCycles: true,
      severity: true, state: true, pendingSince: true,
    },
  });

  // Evaluate all rules concurrently — each rule is independent.
  await Promise.allSettled(rules.map(evaluateRule));
}

export function startEvaluator(intervalSeconds) {
  const seconds = normalizeIntervalSeconds(intervalSeconds);
  evaluationIntervalMs = seconds * 1000;

  const timer = setInterval(() => {
    runEvaluationCycle().catch(() => {});
  }, evaluationIntervalMs);

  timer.unref?.();
  return timer;
}
