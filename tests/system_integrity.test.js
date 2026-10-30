/**
 * Personal Reminder - System Integrity & Security Verification Suite (Phase 7)
 * 
 * Verifies:
 * - Recurrence calculations (boundaries, short months, leap years, DST)
 * - Migration schema integrity (table constraints, foreign keys, indexes, RLS policies)
 * - Idempotency key and duplicate-claim prevention logic
 * - Repository security scan for exposed secrets / credentials
 * 
 * Run with: node tests/system_integrity.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const RecurrenceEngine = require('../assets/js/recurrence.js');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (e) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${e.message}`);
    failCount++;
  }
}

console.log('======================================================');
console.log(' Phase 7 System Integrity & Security Verification');
console.log('======================================================\n');

// GROUP 1: Recurrence Calculations & Calendar Boundaries
console.log('1. Recurrence Engine & Edge Cases:');

it('One-time reminder returns null for next occurrence', () => {
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: '2026-11-01T10:00:00Z',
    timezone: 'Asia/Kolkata',
    recurrenceType: 'none'
  });
  assert.strictEqual(next, null);
});

it('Daily reminder advances 1 day preserving local hour/minute', () => {
  const base = RecurrenceEngine.createZonedDate(2026, 11, 10, 18, 30, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'daily'
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 11);
  assert.strictEqual(parts.day, 11);
  assert.strictEqual(parts.hour, 18);
  assert.strictEqual(parts.minute, 30);
});

it('Weekly recurrence correctly skips to next specified day (Tue -> Thu)', () => {
  // 2026-11-03 is Tuesday (dow = 2)
  const base = RecurrenceEngine.createZonedDate(2026, 11, 3, 10, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'weekly',
    recurrenceDays: [2, 4] // Tue & Thu
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.dow, 4); // Thursday
  assert.strictEqual(parts.day, 5); // Nov 5
});

it('Weekly recurrence wraps over weekend (Thu -> Tue)', () => {
  // 2026-11-05 is Thursday (dow = 4)
  const base = RecurrenceEngine.createZonedDate(2026, 11, 5, 10, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'weekly',
    recurrenceDays: [2, 4] // Tue & Thu
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.dow, 2); // Tuesday
  assert.strictEqual(parts.day, 10); // Nov 10
});

it('Monthly recurrence clamps Day 31 to Feb 28 in non-leap year (2027)', () => {
  const base = RecurrenceEngine.createZonedDate(2027, 1, 31, 9, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 31
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2027);
  assert.strictEqual(parts.month, 2);
  assert.strictEqual(parts.day, 28);
});

it('Monthly recurrence clamps Day 31 to Feb 29 in leap year (2028)', () => {
  const base = RecurrenceEngine.createZonedDate(2028, 1, 31, 9, 0, 0, 'Asia/Kolkata');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'Asia/Kolkata',
    recurrenceType: 'monthly',
    recurrenceMonthDay: 31
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'Asia/Kolkata');
  assert.strictEqual(parts.year, 2028);
  assert.strictEqual(parts.month, 2);
  assert.strictEqual(parts.day, 29);
});

it('Daylight Saving Time: Preserves wall-clock hour in America/New_York across transition', () => {
  // US spring DST in 2026: March 8
  const base = RecurrenceEngine.createZonedDate(2026, 3, 7, 8, 30, 0, 'America/New_York');
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base.toISOString(),
    timezone: 'America/New_York',
    recurrenceType: 'daily'
  });
  const parts = RecurrenceEngine.getZonedParts(next, 'America/New_York');
  assert.strictEqual(parts.day, 8);
  assert.strictEqual(parts.hour, 8);
  assert.strictEqual(parts.minute, 30);
});

it('Hourly recurrence advances drift-free by custom hours and enforces termination constraints', () => {
  const base = '2026-11-01T08:15:00.000Z';
  const next = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 4,
    maxOccurrences: 3,
    occurrencesCount: 1
  });
  assert.ok(next !== null);
  assert.strictEqual(next.toISOString(), '2026-11-01T12:15:00.000Z');

  // Should terminate when maxOccurrences reached
  const terminated = RecurrenceEngine.calculateNextOccurrence({
    scheduledAt: base,
    timezone: 'Asia/Kolkata',
    recurrenceType: 'hourly',
    recurrenceIntervalHours: 4,
    maxOccurrences: 3,
    occurrencesCount: 3
  });
  assert.strictEqual(terminated, null);
});

// GROUP 2: SQL Migration & Schema Constraints
console.log('\n2. Database Schema & RLS Policy Integrity:');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

it('All 5 expected database migrations are present', () => {
  assert.strictEqual(migrationFiles.length, 5);
});

it('Migration 1 creates profiles with RLS enabled and authenticated policies', () => {
  const content = fs.readFileSync(path.join(migrationsDir, '20261030000001_create_profiles.sql'), 'utf8');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('auth.uid() = id'));
  assert.ok(content.includes('auth.users(id) ON DELETE CASCADE'));
});

it('Migration 2 creates reminders & reminder_logs with idempotency constraint and RLS', () => {
  const content = fs.readFileSync(path.join(migrationsDir, '20261030000002_create_reminders_and_logs.sql'), 'utf8');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('auth.uid() = user_id'));
  assert.ok(content.includes('uq_reminder_occurrence_idempotency UNIQUE (reminder_id, scheduled_for)'));
  assert.ok(content.includes('idx_reminders_due'));
});

it('Migration 3 implements server-side calculate_next_occurrence function', () => {
  const content = fs.readFileSync(path.join(migrationsDir, '20261030000003_create_recurrence_engine.sql'), 'utf8');
  assert.ok(content.includes('calculate_next_occurrence'));
  assert.ok(content.includes('v_max_iterations CONSTANT INT := 500'));
});

it('Migration 4 implements concurrency-safe claiming with FOR UPDATE SKIP LOCKED', () => {
  const content = fs.readFileSync(path.join(migrationsDir, '20261030000004_create_scheduler_and_job_queue.sql'), 'utf8');
  assert.ok(content.includes('claim_due_reminders'));
  assert.ok(content.includes('FOR UPDATE OF r SKIP LOCKED'));
  assert.ok(content.includes('complete_reminder_occurrence'));
});

it('Migration 5 implements hourly recurrence, drift prevention, and end conditions', () => {
  const content = fs.readFileSync(path.join(migrationsDir, '20261030000005_add_hourly_recurrence.sql'), 'utf8');
  assert.ok(content.includes('hourly'));
  assert.ok(content.includes('recurrence_interval_hours'));
  assert.ok(content.includes('recurrence_end_at'));
  assert.ok(content.includes('max_occurrences'));
  assert.ok(content.includes('occurrences_count'));
  assert.ok(content.includes('claim_due_reminders'));
  assert.ok(content.includes('complete_reminder_occurrence'));
});

// GROUP 3: Security & Credential Scanning
console.log('\n3. Security Audit & Credential Leakage Scan:');

function scanFileForSecrets(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Test for active Resend API key pattern: re_[30+ alphanumeric chars]
  if (/re_[a-zA-Z0-9]{24,}/.test(content)) {
    issues.push('Possible active Resend API Key');
  }
  // Test for JWT service-role key pattern: eyJ[a-zA-Z0-9_-]{50,}
  if (/eyJ[a-zA-Z0-9_\-\.]{50,}/.test(content)) {
    // Exclude documentation or placeholder examples
    if (!content.includes('eyJhbGci...') && !filePath.includes('config.example.js')) {
      issues.push('Possible hardcoded Supabase JWT Token');
    }
  }
  return issues;
}

it('No active secrets in tracked frontend or server files', () => {
  const rootDir = path.join(__dirname, '..');
  const filesToScan = [
    'login.html',
    'dashboard.html',
    'index.html',
    'assets/js/auth.js',
    'assets/js/dashboard.js',
    'assets/js/reminders.js',
    'assets/js/recurrence.js',
    'assets/js/supabase-client.js',
    'assets/js/config.example.js',
    'supabase/functions/send-due-reminders/index.ts'
  ];

  for (const rel of filesToScan) {
    const fullPath = path.join(rootDir, rel);
    if (fs.existsSync(fullPath)) {
      const issues = scanFileForSecrets(fullPath);
      assert.strictEqual(issues.length, 0, `Secret detected in ${rel}: ${issues.join(', ')}`);
    }
  }
});

it('.gitignore excludes config.js, .env, and local credentials', () => {
  const gitignoreContent = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.ok(gitignoreContent.includes('.env'));
  assert.ok(gitignoreContent.includes('assets/js/config.js'));
  assert.ok(gitignoreContent.includes('*.local'));
});

console.log('\n======================================================');
console.log(` Test Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}
