/**
 * Personal Reminder - Reminder Data & Management Module
 * 
 * Supports Supabase PostgreSQL database storage with Row Level Security (RLS)
 * and seamless fallback to LocalStorage in unconfigured/demo environments.
 */

window.ReminderStore = (function () {
  'use strict';

  const STORAGE_KEY = 'personal_reminders_demo_v1';
  let cachedReminders = [];

  // Seed demo data with dynamic relative dates for unconfigured preview mode
  function generateInitialDemoData() {
    const now = new Date();
    
    const todayDate = new Date(now);
    todayDate.setHours(18, 30, 0, 0);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    yesterdayDate.setHours(14, 0, 0, 0);

    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    tomorrowDate.setHours(10, 0, 0, 0);

    const nextWeekDate = new Date(now);
    nextWeekDate.setDate(now.getDate() + 3);
    nextWeekDate.setHours(9, 15, 0, 0);

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
        recurrence_days: [1, 3, 5],
        recurrence_month_day: null,
        status: 'active',
        is_demo: true
      },
      {
        id: 'demo-2',
        title: 'Renew domain registration for personal project',
        description: 'Check registrar auto-renewal status and update payment details.',
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
        description: 'Daily morning watering cycle before noon.',
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
        description: 'Completed filing with accountant and archived receipts.',
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

  function isSupabaseLive() {
    return window.SupabaseModule && window.SupabaseModule.isConfigured();
  }

  // --- Fetch Reminders ---
  async function fetchAll() {
    if (isSupabaseLive()) {
      const sb = window.SupabaseModule.getClient();
      if (sb) {
        const { data, error } = await sb
          .from('reminders')
          .select('*')
          .order('scheduled_at', { ascending: true });

        if (error) {
          console.error('Error fetching reminders from Supabase:', error);
          throw error;
        }

        cachedReminders = (data || []).map(r => ({ ...r, is_demo: false }));
        return cachedReminders;
      }
    }

    // LocalStorage fallback for demo
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        cachedReminders = JSON.parse(stored);
        return cachedReminders;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    cachedReminders = generateInitialDemoData();
    saveLocal(cachedReminders);
    return cachedReminders;
  }

  function getCached() {
    return cachedReminders;
  }

  function saveLocal(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // --- Create or Update Reminder ---
  async function save(reminderData) {
    if (isSupabaseLive()) {
      const sb = window.SupabaseModule.getClient();
      const user = await window.SupabaseModule.getUser();
      if (!user) throw new Error('You must be signed in to save a reminder.');

      if (reminderData.id) {
        // Update
        const payload = {
          title: reminderData.title,
          description: reminderData.description,
          scheduled_at: reminderData.scheduled_at,
          timezone: reminderData.timezone || 'Asia/Kolkata',
          recurrence_type: reminderData.recurrence_type || 'none',
          recurrence_days: reminderData.recurrence_days,
          recurrence_month_day: reminderData.recurrence_month_day,
          next_run_at: reminderData.scheduled_at,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await sb
          .from('reminders')
          .update(payload)
          .eq('id', reminderData.id)
          .select()
          .single();

        if (error) throw error;
        await fetchAll();
        return data;
      } else {
        // Insert
        const payload = {
          user_id: user.id,
          title: reminderData.title,
          description: reminderData.description,
          scheduled_at: reminderData.scheduled_at,
          timezone: reminderData.timezone || 'Asia/Kolkata',
          recurrence_type: reminderData.recurrence_type || 'none',
          recurrence_days: reminderData.recurrence_days,
          recurrence_month_day: reminderData.recurrence_month_day,
          next_run_at: reminderData.scheduled_at,
          status: 'active'
        };

        const { data, error } = await sb
          .from('reminders')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        await fetchAll();
        return data;
      }
    }

    // Local demo mode
    if (reminderData.id) {
      const idx = cachedReminders.findIndex(r => r.id === reminderData.id);
      if (idx !== -1) {
        cachedReminders[idx] = {
          ...cachedReminders[idx],
          ...reminderData,
          updated_at: new Date().toISOString()
        };
      }
    } else {
      const newRem = {
        ...reminderData,
        id: 'rem_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        status: 'active',
        created_at: new Date().toISOString(),
        is_demo: true
      };
      cachedReminders.unshift(newRem);
    }
    saveLocal(cachedReminders);
    return cachedReminders;
  }

  // --- Delete Reminder ---
  async function remove(id) {
    if (isSupabaseLive()) {
      const sb = window.SupabaseModule.getClient();
      if (sb) {
        const { error } = await sb
          .from('reminders')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchAll();
        return cachedReminders;
      }
    }

    cachedReminders = cachedReminders.filter(r => r.id !== id);
    saveLocal(cachedReminders);
    return cachedReminders;
  }

  // --- Toggle Complete / Active ---
  async function toggleComplete(id) {
    const item = cachedReminders.find(r => r.id === id);
    if (!item) return cachedReminders;

    const newStatus = item.status === 'completed' ? 'active' : 'completed';

    if (isSupabaseLive()) {
      const sb = window.SupabaseModule.getClient();
      if (sb) {
        const { error } = await sb
          .from('reminders')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        await fetchAll();
        return cachedReminders;
      }
    }

    item.status = newStatus;
    saveLocal(cachedReminders);
    return cachedReminders;
  }

  // --- Snooze Reminder ---
  async function snooze(id, additionalMinutes) {
    const item = cachedReminders.find(r => r.id === id);
    if (!item) return cachedReminders;

    const currentScheduled = new Date(item.scheduled_at);
    const baseTime = currentScheduled.getTime() < Date.now() ? Date.now() : currentScheduled.getTime();
    const newScheduled = new Date(baseTime + additionalMinutes * 60 * 1000).toISOString();

    if (isSupabaseLive()) {
      const sb = window.SupabaseModule.getClient();
      if (sb) {
        const { error } = await sb
          .from('reminders')
          .update({
            scheduled_at: newScheduled,
            next_run_at: newScheduled,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        await fetchAll();
        return cachedReminders;
      }
    }

    item.scheduled_at = newScheduled;
    item.status = 'active';
    saveLocal(cachedReminders);
    return cachedReminders;
  }

  // --- Category and Counting Helpers ---
  function getCategory(reminder) {
    if (reminder.status === 'completed') return 'completed';
    const scheduled = new Date(reminder.scheduled_at);
    const now = new Date();

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

  function getCounts() {
    const counts = {
      today: 0,
      upcoming: 0,
      overdue: 0,
      completed: 0,
      recurring: 0,
      total: cachedReminders.length
    };

    cachedReminders.forEach(r => {
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
    fetchAll,
    getCached,
    save,
    remove,
    toggleComplete,
    snooze,
    getCategory,
    getCounts,
    isSupabaseLive
  };
})();
