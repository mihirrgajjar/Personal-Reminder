/**
 * Automated Unit Test Suite for Recurrence Engine (Phase 4)
 * 
 * Run with: node tests/recurrence.test.js
 */

const assert = require('assert');
const RecurrenceEngine = require('../assets/js/recurrence.js');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failedCount++;
  }
}

console.log('=== Running Recurrence Engine Unit Tests ===\n');

// 1. One-time reminder test
runTest('One-time reminder returns null', () => {
  const result = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: '2026-11-01T10:00:00Z',
    timezone: 'Asia/Kolkata',
    recurrenceType: 'none'
  });
  assert.strictEqual(result, null);
});

// 2. Daily reminder test
runTest('Daily reminder advances by exactly 1 day and preserves wall-clock time', () => {
  const base = '2026-11-01T04:30:00.000Z'; // 10:00 AM IST
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'daily'
  });
  assert.ok(next !== null);
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 11);
  assert.strictEqual(parts.day, 2);
  assert.strictEqual(parts.hour, 10);
  assert.strictEqual(parts.minute, 0);
});

// 3. Weekly reminder on Mon, Wed, Fri
runTest('Weekly reminder advances to the next selected weekday (Mon -> Wed)', () => {
  // 2026-11-02 is Monday
  const base = RecurrenceEngine.createZonedDate(2026, 11, 2, 9, 30, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'weekly',
    recurrenceDays: [1, 3, 5] // Mon, Wed, Fri
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.day, 4); // Wednesday Nov 4
  assert.strictEqual(parts.dow, 3); // Wednesday
  assert.strictEqual(parts.hour, 9);
  assert.strictEqual(parts.minute, 30);
});

// 4. Weekly reminder wrapping weekend (Fri -> Mon)
runTest('Weekly reminder wraps over weekend to Monday (Fri -> Mon)', () => {
  // 2026-11-06 is Friday
  const base = RecurrenceEngine.createZonedDate(2026, 11, 6, 9, 30, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'weekly',
    recurrenceDays: [1, 3, 5] // Mon, Wed, Fri
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.day, 9); // Monday Nov 9
  assert.strictEqual(parts.dow, 1); // Monday
});

// 5. Monthly reminder on regular day (15th)
runTest('Monthly reminder on the 15th advances to next month 15th', () => {
  const base = RecurrenceEngine.createZonedDate(2026, 3, 15, 14, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 15
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 4);
  assert.strictEqual(parts.day, 15);
  assert.strictEqual(parts.hour, 14);
});

// 6. Monthly reminder on 31st clamping to shorter month (Jan 31 -> Feb 28 in non-leap year)
runTest('Monthly reminder on 31st clamps to Feb 28 in non-leap year', () => {
  const base = RecurrenceEngine.createZonedDate(2027, 1, 31, 10, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 31
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2027);
  assert.strictEqual(parts.month, 2);
  assert.strictEqual(parts.day, 28); // Feb 28
  assert.strictEqual(parts.hour, 10);
});

// 7. Monthly reminder on 31st in leap year (Jan 31 2028 -> Feb 29 2028)
runTest('Monthly reminder on 31st clamps to Feb 29 in leap year (2028)', () => {
  const base = RecurrenceEngine.createZonedDate(2028, 1, 31, 11, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 31
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2028);
  assert.strictEqual(parts.month, 2);
  assert.strictEqual(parts.day, 29); // Feb 29
  assert.strictEqual(parts.hour, 11);
});

// 8. Year boundary rollover (Dec 31 -> Jan 31 next year)
runTest('Monthly reminder rolls over year boundary (Dec 31 -> Jan 31 next year)', () => {
  const base = RecurrenceEngine.createZonedDate(2026, 12, 31, 8, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 31
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2027);
  assert.strictEqual(parts.month, 1);
  assert.strictEqual(parts.day, 31);
  assert.strictEqual(parts.hour, 8);
});

// 9. Timezone preservation across DST
runTest('Preserves local wall-clock time across DST in America/New_York', () => {
  // In 2026, US Daylight Saving Time begins March 8
  const base = RecurrenceEngine.createZonedDate(2026, 3, 7, 9, 0, 0, 'America/New_York');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'America/New_York',
    recurrenceType: 'daily'
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'America/New_York');
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 3);
  assert.strictEqual(parts.day, 8);
  assert.strictEqual(parts.hour, 9); // Remains 9:00 AM local time
  assert.strictEqual(parts.minute, 0);
});

// 10. Advance from scheduled occurrence rather than invocation time
runTest('Advances from intended scheduled occurrence, not current time', () => {
  const pastScheduled = RecurrenceEngine.createZonedDate(2026, 1, 1, 10, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: pastScheduled.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'daily'
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  // First next occurrence from 2026-01-01 is 2026-01-02
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 1);
  assert.strictEqual(parts.day, 2);
  assert.strictEqual(parts.hour, 10);
});

// 11. Hourly recurrence - Every 1 hour
runTest('Hourly recurrence advances by exactly 1 hour (drift-free)', () => {
  const base = '2026-11-01T10:00:00.000Z';
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 1
  });
  assert.ok(next !== null);
  assert.strictEqual(next.toISOString(), '2026-11-01T11:00:00.000Z');
});

// 12. Hourly recurrence - Custom interval (3 hours)
runTest('Hourly recurrence with custom interval (3 hours) advances by 3 hours', () => {
  const base = '2026-11-01T04:15:30.000Z';
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 3
  });
  assert.ok(next !== null);
  assert.strictEqual(next.toISOString(), '2026-11-01T07:15:30.000Z');
  // Exact minutes and seconds are preserved without drift
  assert.strictEqual(next.getUTCMinutes(), 15);
  assert.strictEqual(next.getUTCSeconds(), 30);
});

// 13. Sequential hourly recurrence preserves timing drift over 10 steps
runTest('Hourly recurrence prevents timing drift across 10 steps', () => {
  const base = '2026-11-01T12:00:00.000Z';
  let current = base;
  for (let i = 1; i <= 10; i++) {
    const next = RecurrenceEngine.calculateNextOccurrence({
      scheduledAt: current,
      timezone: 'UTC',
      recurrenceType: 'hourly',
      recurrenceIntervalHours: 2
    });
    assert.strictEqual(next.getTime(), new Date(base).getTime() + (i * 2 * 3600 * 1000));
    current = next.toISOString();
  }
});

// 14. Maximum occurrences termination
runTest('Recurrence terminates (returns null) when maxOccurrences is reached', () => {
  const base = '2026-11-01T10:00:00.000Z';
  // Before limit
  const active = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 1,
    maxOccurrences: 5,
    occurrencesCount: 4
  });
  assert.ok(active !== null);

  // At limit
  const terminated = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 1,
    maxOccurrences: 5,
    occurrencesCount: 5
  });
  assert.strictEqual(terminated, null);
});

// 15. End datetime termination
runTest('Recurrence terminates (returns null) when next occurrence exceeds recurrenceEndAt', () => {
  const base = '2026-11-01T10:00:00.000Z';
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 4,
    recurrenceEndAt: '2026-11-01T13:00:00.000Z' // 3 hours after base; next run would be +4 hours
  });
  assert.strictEqual(next, null);
});

// 16. Continuous recurrence when no end conditions provided
runTest('Continues indefinitely when neither maxOccurrences nor recurrenceEndAt is set', () => {
  const base = '2026-11-01T10:00:00.000Z';
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 1,
    occurrencesCount: 9999
  });
  assert.ok(next !== null);
  assert.strictEqual(next.toISOString(), '2026-11-01T11:00:00.000Z');
});

console.log(`\n========================================`);
console.log(`Summary: ${passedCount} passed, ${failedCount} failed`);
console.log(`========================================`);

if (failedCount > 0) {
  process.exit(1);
}
