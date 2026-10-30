/**
 * Personal Reminder - Recurrence Calculation Engine
 * 
 * Computes deterministic next occurrences for recurring reminders:
 * - One-time ('none'): returns null
 * - Daily: exactly 1 day later, preserving wall-clock time in reminder timezone
 * - Weekly: next occurrence among specified weekdays (0=Sun, 1=Mon, ..., 6=Sat)
 * - Monthly: target day in the next month, clamped to the month's last valid day
 * 
 * Works in both browser environments (window.RecurrenceEngine) and Node/Deno (module.exports / ES export).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RecurrenceEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Helper: Get number of days in a given year & month (1-indexed month: 1=Jan, 12=Dec)
   */
  function getDaysInMonth(year, month) {
    // Setting day to 0 of month+1 gets the last day of month
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /**
   * Helper: Parse ISO string to year, month, day, hour, minute, second in target timezone
   */
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

    // Weekday (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const dowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short'
    });
    const dowShort = dowFormatter.format(dateObj);
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[dowShort] !== undefined ? dowMap[dowShort] : 0;

    return {
      year: map.year,
      month: map.month, // 1 to 12
      day: map.day,
      hour: map.hour === 24 ? 0 : map.hour,
      minute: map.minute,
      second: map.second,
      dow
    };
  }

  /**
   * Helper: Construct an ISO string for a given wall-clock year, month, day, hour, minute, second in a timezone
   */
  function createZonedDate(year, month, day, hour, minute, second, timeZone) {
    const tz = timeZone || 'Asia/Kolkata';

    // Format target time string "YYYY-MM-DDTHH:mm:ss"
    const pad = (n) => String(n).padStart(2, '0');
    const targetIsoApprox = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;

    // Resolve UTC offset by iteration (handles DST transitions smoothly)
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
   * 
   * @param {Object} options
   * @param {string|Date} options.scheduledAt - Base scheduled timestamp
   * @param {string} options.timezone - Timezone string (e.g. 'Asia/Kolkata')
   * @param {string} options.recurrenceType - 'none', 'daily', 'weekly', 'monthly'
   * @param {number[]} [options.recurrenceDays] - Array of weekdays [0..6] for weekly
   * @param {number} [options.recurrenceMonthDay] - Day of month (1..31) for monthly
   * @param {Date} [options.afterDate] - Ensure result is strictly after this timestamp (defaults to scheduledAt)
   * @returns {Date|null}
   */
  function calculateNextOccurrence(options) {
    const {
      scheduledAt,
      timezone = 'Asia/Kolkata',
      recurrenceType = 'none',
      recurrenceDays = null,
      recurrenceMonthDay = null,
      afterDate = null
    } = options;

    if (!scheduledAt || recurrenceType === 'none') {
      return null;
    }

    const baseDate = new Date(scheduledAt);
    if (isNaN(baseDate.getTime())) {
      throw new Error('Invalid scheduledAt timestamp provided to calculateNextOccurrence.');
    }

    const thresholdMs = (afterDate ? new Date(afterDate) : baseDate).getTime();
    const parts = getZonedParts(baseDate, timezone);

    let nextDate = null;
    const MAX_CYCLES = 500;
    let cycles = 0;

    // 1. DAILY
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
          return candidate;
        }
      }
      return null;
    }

    // 2. WEEKLY
    if (recurrenceType === 'weekly') {
      const days = Array.isArray(recurrenceDays) && recurrenceDays.length > 0
        ? recurrenceDays.slice().sort((a, b) => a - b)
        : [parts.dow]; // Default to same weekday if none selected

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
            return candidate;
          }
        }
      }
      return null;
    }

    // 3. MONTHLY
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

        // Clamp day to month length (e.g., 31 in Feb -> 28 or 29)
        const dim = getDaysInMonth(curYear, curMonth);
        const validDay = Math.min(targetDay, dim);

        const candidate = createZonedDate(curYear, curMonth, validDay, parts.hour, parts.minute, parts.second, timezone);
        if (candidate.getTime() > thresholdMs) {
          return candidate;
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
