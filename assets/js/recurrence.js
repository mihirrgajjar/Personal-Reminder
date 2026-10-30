/**
 * Personal Reminder - Recurrence Calculation Engine
 * 
 * Computes deterministic next occurrences for recurring reminders:
 * - One-time ('none'): returns null
 * - Hourly: exactly N hours later from scheduled timestamp (drift-free)
 * - Daily: exactly 1 day later, preserving wall-clock time in reminder timezone
 * - Weekly: next occurrence among specified weekdays (0=Sun, 1=Mon, ..., 6=Sat)
 * - Monthly: target day in the next month, clamped to the month's last valid day
 * 
 * Supports optional termination conditions:
 * - recurrenceEndAt: stop if next occurrence exceeds timestamp
 * - maxOccurrences: stop after N total successful dispatches
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RecurrenceEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function getZonedParts(dateObj, timeZone) {
    const tz = timeZone || 'Asia/Kolkata';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(dateObj);
    const map = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type !== 'literal') {
        map[parts[i].type] = parseInt(parts[i].value, 10);
      }
    }

    const dowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short'
    });
    const dowShort = dowFormatter.format(dateObj);
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[dowShort] !== undefined ? dowMap[dowShort] : 0;

    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: map.hour === 24 ? 0 : map.hour,
      minute: map.minute,
      second: map.second,
      dow
    };
  }

  function createZonedDate(year, month, day, hour, minute, second, timeZone) {
    const tz = timeZone || 'Asia/Kolkata';
    let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    
    for (let i = 0; i < 4; i++) {
      const parts = getZonedParts(guess, tz);
      const diffMs = (Date.UTC(year, month - 1, day, hour, minute, second) - 
                      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
      if (diffMs === 0) break;
      guess = new Date(guess.getTime() + diffMs);
    }

    return guess;
  }

  /**
   * Main calculation function
   */
  function calculateNextOccurrence(options) {
    const {
      scheduledAt,
      timezone = 'Asia/Kolkata',
      recurrenceType = 'none',
      recurrenceDays = null,
      recurrenceMonthDay = null,
      recurrenceIntervalHours = 1,
      recurrenceEndAt = null,
      maxOccurrences = null,
      occurrencesCount = 0,
      afterDate = null
    } = options;

    if (!scheduledAt || recurrenceType === 'none') {
      return null;
    }

    // Check maximum repetitions limit
    if (maxOccurrences !== null && maxOccurrences !== undefined && maxOccurrences > 0) {
      if (occurrencesCount >= maxOccurrences) {
        return null;
      }
    }

    const baseDate = new Date(scheduledAt);
    if (isNaN(baseDate.getTime())) {
      throw new Error('Invalid scheduledAt timestamp provided to calculateNextOccurrence.');
    }

    const thresholdMs = (afterDate ? new Date(afterDate) : baseDate).getTime();
    const endMs = recurrenceEndAt ? new Date(recurrenceEndAt).getTime() : null;

    // Helper: Verify end date boundary
    function checkCandidate(candidateDate) {
      if (!candidateDate) return null;
      if (endMs && candidateDate.getTime() > endMs) {
        return null;
      }
      return candidateDate;
    }

    const MAX_CYCLES = 500;
    let cycles = 0;

    // 1. HOURLY
    if (recurrenceType === 'hourly') {
      const intervalHours = Math.max(1, parseInt(recurrenceIntervalHours, 10) || 1);
      const intervalMs = intervalHours * 3600 * 1000;

      // Advance by exact multiples of interval from baseDate to eliminate timing drift
      let candidateMs = baseDate.getTime() + intervalMs;
      while (candidateMs <= thresholdMs && cycles < MAX_CYCLES) {
        cycles++;
        candidateMs += intervalMs;
      }

      const candidate = new Date(candidateMs);
      return checkCandidate(candidate);
    }

    const parts = getZonedParts(baseDate, timezone);

    // 2. DAILY
    if (recurrenceType === 'daily') {
      let curYear = parts.year;
      let curMonth = parts.month;
      let curDay = parts.day;

      while (cycles < MAX_CYCLES) {
        cycles++;
        curDay++;
        const dim = getDaysInMonth(curYear, curMonth);
        if (curDay > dim) {
          curDay = 1;
          curMonth++;
          if (curMonth > 12) {
            curMonth = 1;
            curYear++;
          }
        }

        const candidate = createZonedDate(curYear, curMonth, curDay, parts.hour, parts.minute, parts.second, timezone);
        if (candidate.getTime() > thresholdMs) {
          return checkCandidate(candidate);
        }
      }
      return null;
    }

    // 3. WEEKLY
    if (recurrenceType === 'weekly') {
      const days = Array.isArray(recurrenceDays) && recurrenceDays.length > 0
        ? recurrenceDays.slice().sort((a, b) => a - b)
        : [parts.dow];

      let curYear = parts.year;
      let curMonth = parts.month;
      let curDay = parts.day;

      while (cycles < MAX_CYCLES) {
        cycles++;
        curDay++;
        const dim = getDaysInMonth(curYear, curMonth);
        if (curDay > dim) {
          curDay = 1;
          curMonth++;
          if (curMonth > 12) {
            curMonth = 1;
            curYear++;
          }
        }

        const candidate = createZonedDate(curYear, curMonth, curDay, parts.hour, parts.minute, parts.second, timezone);
        const candParts = getZonedParts(candidate, timezone);

        if (days.includes(candParts.dow)) {
          if (candidate.getTime() > thresholdMs) {
            return checkCandidate(candidate);
          }
        }
      }
      return null;
    }

    // 4. MONTHLY
    if (recurrenceType === 'monthly') {
      const targetDay = recurrenceMonthDay || parts.day;
      let curYear = parts.year;
      let curMonth = parts.month;

      while (cycles < MAX_CYCLES) {
        cycles++;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }

        const dim = getDaysInMonth(curYear, curMonth);
        const validDay = Math.min(targetDay, dim);

        const candidate = createZonedDate(curYear, curMonth, validDay, parts.hour, parts.minute, parts.second, timezone);
        if (candidate.getTime() > thresholdMs) {
          return checkCandidate(candidate);
        }
      }
      return null;
    }

    return null;
  }

  return {
    calculateNextOccurrence,
    getDaysInMonth,
    getZonedParts,
    createZonedDate
  };
});
