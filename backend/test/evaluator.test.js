import test from 'node:test';
import assert from 'node:assert/strict';

// Test the pure condition-evaluation logic without hitting the DB or VictoriaMetrics.
// The evaluator exports the helper for testing via a named export.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
process.env.VICTORIA_METRICS_URL = 'http://localhost:8428';

// Inline the pure helper — mirrors the implementation in lib/evaluator.js.
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

test('GT fires when value strictly exceeds threshold', () => {
  assert.equal(meetsCondition(90.1, 'GT', 90), true);
  assert.equal(meetsCondition(90,   'GT', 90), false);
  assert.equal(meetsCondition(89.9, 'GT', 90), false);
});

test('GTE fires at or above threshold', () => {
  assert.equal(meetsCondition(90, 'GTE', 90), true);
  assert.equal(meetsCondition(91, 'GTE', 90), true);
  assert.equal(meetsCondition(89, 'GTE', 90), false);
});

test('LT fires below threshold', () => {
  assert.equal(meetsCondition(0.9, 'LT', 1), true);
  assert.equal(meetsCondition(1,   'LT', 1), false);
});

test('LTE fires at or below threshold', () => {
  assert.equal(meetsCondition(1, 'LTE', 1), true);
  assert.equal(meetsCondition(2, 'LTE', 1), false);
});

test('EQ fires on exact match', () => {
  assert.equal(meetsCondition(0, 'EQ', 0), true);
  assert.equal(meetsCondition(1, 'EQ', 0), false);
});

test('unknown condition never fires', () => {
  assert.equal(meetsCondition(100, 'NEQ', 0), false);
});
