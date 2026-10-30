/**
 * Personal Reminder - Reminder Data & Management Module
 * 
 * Provides storage, calculations, and CRUD operations.
 * Initialized with realistic placeholder demo data for Phase 1.
 */

window.ReminderStore = (function () {
  'use strict';

  const STORAGE_KEY = 'personal_reminders_demo_v1';

  // Seed demo data with dynamic relative dates so it always reflects realistic states
  function generateInitialDemoData() {
    const now = new Date();
    
    // Today reminder (later today)
    const todayDate = new Date(now);
    todayDate.setHours(18, 30, 0, 0);

    // Overdue reminder (yesterday)
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    yesterdayDate.setHours(14, 0, 0, 0);

    // Upcoming reminder (tomorrow)
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    tomorrowDate.setHours(10, 0, 0, 0);

    // Upcoming recurring weekly reminder (in 3 days)
    const nextWeekDate = new Date(now);
    nextWeekDate.setDate(now.getDate() + 3);
    nextWeekDate.setHours(9, 15, 0, 0);

    // Completed reminder (2 days ago)
    const completedDate = new Date(now);
    completedDate.setDate(now.getDate() - 2);
    completedDate.setHours(11, 0, 0, 0);

    return [
      {
        id: 'demo-1',
        title: 'Review weekly server backup logs',
        description: 'Verify automated database dump integrity and S3 bucket synchronization.',
        scheduled_at: todayDate.toISOString(),
        timezone: 'Asia/Kolkata',
        recurrence_type: 'weekly',
        recurrence_days: [1, 3, 5], // Mon, Wed, Fri
        recurrence_month_day: null,
        status: 'active',
        is_demo: true
      },
      {
        id: 'demo-2',
        title: 'Renew domain registration for personal project',
        description: 'Check registrar auto-renewal status and update credit card details.',
        scheduled_at: yesterdayDate.toISOString(),
        timezone: 'Asia/Kolkata',
        recurrence_type: 'none',
        recurrence_days: null,
        recurrence_month_day: null,
        status: 'active',
        is_demo: true
      },
      {
        id: 'demo-3',
        title: 'Submit monthly utility bill payment',
        description: 'Check electricity and high-speed internet bills.',
        scheduled_at: tomorrowDate.toISOString(),
        timezone: 'Asia/Kolkata',
        recurrence_type: 'monthly',
        recurrence_days: null,
        recurrence_month_day: 5,
        status: 'active',
        is_demo: true
      },
      {
        id: 'demo-4',
        title: 'Water the indoor plants & balcony garden',
        description: 'Daily watering cycle before noon.',
        scheduled_at: nextWeekDate.toISOString(),
        timezone: 'Asia/Kolkata',
        recurrence_type: 'daily',
        recurrence_days: null,
        recurrence_month_day: null,
        status: 'active',
        is_demo: true
      },
      {
        id: 'demo-5',
        title: 'File quarterly tax advance',
        description: 'Finished filing with accountant and receipts archived.',
        scheduled_at: completedDate.toISOString(),
        timezone: 'Asia/Kolkata',
        recurrence_type: 'none',
        recurrence_days: null,
        recurrence_month_day: null,
        status: 'completed',
        is_demo: true
      }
    ];
  }

  // Load from LocalStorage or initialize with demo data
  function getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('LocalStorage unavailable, using in-memory demo data.', e);
    }
    const initial = generateInitialDemoData();
    saveAll(initial);
    return initial;
  }

  function saveAll(reminders) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
      console.warn('Unable to persist to LocalStorage.', e);
    }
  }

  // Add or Update
  function save(reminderData) {
    const reminders = getAll();
    if (reminderData.id) {
      // Update
      const index = reminders.findIndex(r => r.id === reminderData.id);
      if (index !== -1) {
        reminders[index] = {
          ...reminders[index],
          ...reminderData,
          updated_at: new Date().toISOString()
        };
      }
    } else {
      // Create
      const newReminder = {
        ...reminderData,
        id: 'rem_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        status: 'active',
        created_at: new Date().toISOString(),
        is_demo: true
      };
      reminders.unshift(newReminder);
    }
    saveAll(reminders);
    return reminders;
  }

  // Delete
  function remove(id) {
    let reminders = getAll();
    reminders = reminders.filter(r => r.id !== id);
    saveAll(reminders);
    return reminders;
  }

  // Toggle Complete / Active
  function toggleComplete(id) {
    const reminders = getAll();
    const item = reminders.find(r => r.id === id);
    if (item) {
      item.status = (item.status === 'completed') ? 'active' : 'completed';
      saveAll(reminders);
    }
    return reminders;
  }

  // Snooze
  function snooze(id, additionalMinutes) {
    const reminders = getAll();
    const item = reminders.find(r => r.id === id);
    if (item) {
      const currentScheduled = new Date(item.scheduled_at);
      const baseTime = currentScheduled.getTime() < Date.now() ? Date.now() : currentScheduled.getTime();
      const newTime = new Date(baseTime + additionalMinutes * 60 * 1000);
      item.scheduled_at = newTime.toISOString();
      item.status = 'active'; // reactive if completed
      saveAll(reminders);
    }
    return reminders;
  }

  // Date category helper: today, upcoming, overdue
  function getCategory(reminder) {
    if (reminder.status === 'completed') return 'completed';
    const scheduled = new Date(reminder.scheduled_at);
    const now = new Date();

    // Check if same calendar day
    const isSameDay = scheduled.getFullYear() === now.getFullYear() &&
                      scheduled.getMonth() === now.getMonth() &&
                      scheduled.getDate() === now.getDate();

    if (scheduled < now && !isSameDay) {
      return 'overdue';
    }
    if (isSameDay) {
      return 'today';
    }
    return 'upcoming';
  }

  // Get statistics counts
  function getCounts() {
    const reminders = getAll();
    const counts = {
      today: 0,
      upcoming: 0,
      overdue: 0,
      completed: 0,
      recurring: 0,
      total: reminders.length
    };

    reminders.forEach(r => {
      if (r.status === 'completed') {
        counts.completed++;
      } else {
        const cat = getCategory(r);
        if (cat === 'today') counts.today++;
        else if (cat === 'overdue') counts.overdue++;
        else if (cat === 'upcoming') counts.upcoming++;
      }

      if (r.recurrence_type && r.recurrence_type !== 'none') {
        counts.recurring++;
      }
    });

    return counts;
  }

  return {
    getAll,
    save,
    remove,
    toggleComplete,
    snooze,
    getCategory,
    getCounts
  };
})();
