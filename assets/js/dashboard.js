/**
 * Personal Reminder - Dashboard Controller
 * 
 * Manages UI interactions, modals, list filtering, summary metrics,
 * Supabase route protection, database CRUD, and profile synchronization.
 */

(async function () {
  'use strict';

  // State
  let currentFilter = 'all';
  let activeSnoozeId = null;
  let activeTimezone = 'Asia/Kolkata';
  let currentUser = null;
  let isLiveAuth = false;

  // Route Protection & Session Initialization
  if (window.SupabaseModule) {
    const authResult = await window.SupabaseModule.requireAuth();
    if (!authResult) return; // unauthenticated redirect occurred
    currentUser = authResult.user;
    isLiveAuth = !authResult.isDemo;
  }

  // DOM Elements - Navigation & Views
  const tabBtnReminders = document.getElementById('tab-btn-reminders');
  const tabBtnSettings = document.getElementById('tab-btn-settings');
  const btnLogout = document.getElementById('btn-logout');
  const viewReminders = document.getElementById('view-reminders');
  const viewSettings = document.getElementById('view-settings');
  const currentTzLabel = document.getElementById('current-tz-label');
  const currentClockLabel = document.getElementById('current-clock-label');

  // DOM Elements - Summary Cards & Filters
  const countToday = document.getElementById('count-today');
  const countUpcoming = document.getElementById('count-upcoming');
  const countOverdue = document.getElementById('count-overdue');
  const countCompleted = document.getElementById('count-completed');
  const filterDisplayCount = document.getElementById('filter-display-count');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const summaryCards = document.querySelectorAll('.summary-card');

  // DOM Elements - Lists & Containers
  const remindersContainer = document.getElementById('reminders-container');
  const emptyState = document.getElementById('empty-state');
  const emptyStateDesc = document.getElementById('empty-state-desc');
  const loadingState = document.getElementById('loading-state');
  const toastAlert = document.getElementById('toast-alert');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  // DOM Elements - Add / Edit Modal
  const reminderModal = document.getElementById('reminder-modal');
  const reminderForm = document.getElementById('reminder-form');
  const modalHeadline = document.getElementById('modal-headline');
  const btnOpenCreate = document.getElementById('btn-open-create');
  const btnEmptyCreate = document.getElementById('btn-empty-create');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnSaveReminder = document.getElementById('btn-save-reminder');

  const formId = document.getElementById('reminder-id');
  const formTitle = document.getElementById('form-title');
  const formDesc = document.getElementById('form-desc');
  const formDate = document.getElementById('form-date');
  const formTime = document.getElementById('form-time');
  const formRecurrence = document.getElementById('form-recurrence');
  const weeklyDaysGroup = document.getElementById('weekly-days-group');
  const monthlyDayGroup = document.getElementById('monthly-day-group');
  const formMonthDay = document.getElementById('form-month-day');
  const weekdayButtons = document.querySelectorAll('.weekday-btn');

  const titleError = document.getElementById('title-error');
  const dateError = document.getElementById('date-error');
  const timeError = document.getElementById('time-error');
  const weekdayError = document.getElementById('weekday-error');

  // DOM Elements - Snooze Modal
  const snoozeModal = document.getElementById('snooze-modal');
  const snoozeTitleLabel = document.getElementById('snooze-reminder-title-label');
  const btnCloseSnooze = document.getElementById('btn-close-snooze');
  const btnCancelSnooze = document.getElementById('btn-cancel-snooze');
  const snoozeOptions = document.querySelectorAll('.snooze-option');

  // DOM Elements - Settings Form
  const settingsForm = document.getElementById('settings-form');
  const settingEmail = document.getElementById('setting-email');
  const settingTimezone = document.getElementById('setting-timezone');

  // --- Sign Out Handler ---
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      if (isLiveAuth && window.SupabaseModule) {
        await window.SupabaseModule.signOut();
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  // --- Profile Loading ---
  async function loadUserProfile() {
    if (isLiveAuth && currentUser && currentUser.id) {
      try {
        const profile = await window.SupabaseModule.getProfile(currentUser.id);
        if (profile) {
          if (profile.destination_email && settingEmail) {
            settingEmail.value = profile.destination_email;
          }
          if (profile.timezone && settingTimezone) {
            settingTimezone.value = profile.timezone;
            activeTimezone = profile.timezone;
            if (currentTzLabel) currentTzLabel.textContent = profile.timezone;
            updateClock();
          }
        } else if (currentUser.email && settingEmail) {
          settingEmail.value = currentUser.email;
        }
      } catch (e) {
        console.warn('Could not load profile from Supabase:', e.message);
      }
    }
  }

  // --- Toast Alerts ---
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (!toastAlert) return;
    clearTimeout(toastTimer);
    toastAlert.className = `alert alert-${type}`;
    toastMessage.textContent = message;

    if (type === 'success') {
      toastIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    } else {
      toastIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
    }
    toastAlert.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastAlert.classList.add('hidden');
    }, 4000);
  }

  // --- Clock & Timezone ---
  function updateClock() {
    if (!currentClockLabel) return;
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: activeTimezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      currentClockLabel.textContent = formatter.format(now);
    } catch (e) {
      currentClockLabel.textContent = new Date().toLocaleTimeString();
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Navigation Tabs ---
  function switchView(viewName) {
    if (viewName === 'reminders') {
      tabBtnReminders.classList.add('active');
      tabBtnSettings.classList.remove('active');
      viewReminders.classList.remove('hidden');
      viewSettings.classList.add('hidden');
    } else {
      tabBtnSettings.classList.add('active');
      tabBtnReminders.classList.remove('active');
      viewSettings.classList.remove('hidden');
      viewReminders.classList.add('hidden');
    }
  }

  if (tabBtnReminders) tabBtnReminders.addEventListener('click', () => switchView('reminders'));
  if (tabBtnSettings) tabBtnSettings.addEventListener('click', () => switchView('settings'));

  const recurrencePreviewBox = document.getElementById('recurrence-preview-box');
  const recurrencePreviewText = document.getElementById('recurrence-preview-text');

  // --- Recurrence Form Toggle & Preview ---
  function updateRecurrenceInputs() {
    const val = formRecurrence.value;
    if (val === 'weekly') {
      weeklyDaysGroup.classList.remove('hidden');
      monthlyDayGroup.classList.add('hidden');
    } else if (val === 'monthly') {
      weeklyDaysGroup.classList.add('hidden');
      monthlyDayGroup.classList.remove('hidden');
    } else {
      weeklyDaysGroup.classList.add('hidden');
      monthlyDayGroup.classList.add('hidden');
    }
    updateRecurrencePreview();
  }

  function updateRecurrencePreview() {
    if (!recurrencePreviewBox || !recurrencePreviewText) return;
    const recType = formRecurrence.value;
    if (recType === 'none' || !window.RecurrenceEngine) {
      recurrencePreviewBox.classList.add('hidden');
      return;
    }

    const dateVal = formDate.value;
    const timeVal = formTime.value;
    if (!dateVal || !timeVal) {
      recurrencePreviewBox.classList.add('hidden');
      return;
    }

    const [year, month, day] = dateVal.split('-').map(Number);
    const [hours, minutes] = timeVal.split(':').map(Number);
    const scheduledDate = new Date(year, month - 1, day, hours, minutes);

    let selectedWeekdays = [];
    if (recType === 'weekly') {
      weekdayButtons.forEach(b => {
        if (b.classList.contains('selected')) {
          selectedWeekdays.push(parseInt(b.dataset.day, 10));
        }
      });
    }

    try {
      const nextDate = window.RecurrenceEngine.calculateNextOccurrence({
        scheduledAt: scheduledDate.toISOString(),
        timezone: activeTimezone,
        recurrenceType: recType,
        recurrenceDays: selectedWeekdays,
        recurrenceMonthDay: parseInt(formMonthDay.value, 10) || 1
      });

      if (nextDate) {
        recurrencePreviewText.textContent = `Following run after initial schedule: ${formatScheduleTime(nextDate.toISOString())} (${activeTimezone})`;
        recurrencePreviewBox.classList.remove('hidden');
      } else {
        recurrencePreviewBox.classList.add('hidden');
      }
    } catch (e) {
      recurrencePreviewBox.classList.add('hidden');
    }
  }

  formRecurrence.addEventListener('change', updateRecurrenceInputs);
  formDate.addEventListener('change', updateRecurrencePreview);
  formTime.addEventListener('change', updateRecurrencePreview);
  formMonthDay.addEventListener('input', updateRecurrencePreview);

  // Weekday selection toggles
  weekdayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      if (document.querySelectorAll('.weekday-btn.selected').length > 0) {
        weekdayError.classList.add('hidden');
      }
      updateRecurrencePreview();
    });
  });

  // --- Modal Management ---
  function openCreateModal() {
    modalHeadline.textContent = 'New Reminder';
    formId.value = '';
    formTitle.value = '';
    formDesc.value = '';
    
    // Default to next hour
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    formDate.value = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    formTime.value = `${hours}:${minutes}`;

    formRecurrence.value = 'none';
    formMonthDay.value = '1';
    weekdayButtons.forEach(b => b.classList.remove('selected'));
    updateRecurrenceInputs();

    clearFormErrors();
    reminderModal.classList.add('open');
    formTitle.focus();
  }

  function openEditModal(id) {
    const reminders = window.ReminderStore.getCached();
    const item = reminders.find(r => r.id === id);
    if (!item) return;

    modalHeadline.textContent = 'Edit Reminder';
    formId.value = item.id;
    formTitle.value = item.title;
    formDesc.value = item.description || '';

    const scheduled = new Date(item.scheduled_at);
    formDate.value = scheduled.toISOString().split('T')[0];
    const hours = String(scheduled.getHours()).padStart(2, '0');
    const minutes = String(scheduled.getMinutes()).padStart(2, '0');
    formTime.value = `${hours}:${minutes}`;

    formRecurrence.value = item.recurrence_type || 'none';
    formMonthDay.value = item.recurrence_month_day || '1';

    weekdayButtons.forEach(btn => {
      const dayNum = parseInt(btn.dataset.day, 10);
      if (Array.isArray(item.recurrence_days) && item.recurrence_days.includes(dayNum)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    updateRecurrenceInputs();
    clearFormErrors();

    reminderModal.classList.add('open');
    formTitle.focus();
  }

  function closeModal() {
    reminderModal.classList.remove('open');
  }

  function clearFormErrors() {
    titleError.classList.add('hidden');
    dateError.classList.add('hidden');
    timeError.classList.add('hidden');
    weekdayError.classList.add('hidden');
    formTitle.classList.remove('error');
    formDate.classList.remove('error');
    formTime.classList.remove('error');
  }

  if (btnOpenCreate) btnOpenCreate.addEventListener('click', openCreateModal);
  if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openCreateModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  reminderModal.addEventListener('click', (e) => {
    if (e.target === reminderModal) closeModal();
  });

  // --- Snooze Modal ---
  function openSnoozeModal(id, title) {
    activeSnoozeId = id;
    snoozeTitleLabel.textContent = `"${title}"`;
    snoozeModal.classList.add('open');
  }

  function closeSnoozeModal() {
    snoozeModal.classList.remove('open');
    activeSnoozeId = null;
  }

  if (btnCloseSnooze) btnCloseSnooze.addEventListener('click', closeSnoozeModal);
  if (btnCancelSnooze) btnCancelSnooze.addEventListener('click', closeSnoozeModal);
  snoozeModal.addEventListener('click', (e) => {
    if (e.target === snoozeModal) closeSnoozeModal();
  });

  snoozeOptions.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!activeSnoozeId) return;
      const minutes = parseInt(btn.dataset.minutes, 10);
      try {
        await window.ReminderStore.snooze(activeSnoozeId, minutes);
        closeSnoozeModal();
        renderDashboard();
        showToast('Reminder snoozed successfully.');
      } catch (err) {
        showToast(`Failed to snooze: ${err.message}`, 'error');
      }
    });
  });

  // --- Form Validation & Submission ---
  reminderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const title = formTitle.value.trim();
    const dateVal = formDate.value;
    const timeVal = formTime.value;
    const recurrence = formRecurrence.value;

    let isValid = true;

    if (!title) {
      formTitle.classList.add('error');
      titleError.textContent = 'Please enter a reminder title.';
      titleError.classList.remove('hidden');
      isValid = false;
    }

    if (!dateVal) {
      formDate.classList.add('error');
      dateError.textContent = 'Please choose a date.';
      dateError.classList.remove('hidden');
      isValid = false;
    }

    if (!timeVal) {
      formTime.classList.add('error');
      timeError.textContent = 'Please choose a time.';
      timeError.classList.remove('hidden');
      isValid = false;
    }

    let selectedWeekdays = [];
    if (recurrence === 'weekly') {
      weekdayButtons.forEach(b => {
        if (b.classList.contains('selected')) {
          selectedWeekdays.push(parseInt(b.dataset.day, 10));
        }
      });
      if (selectedWeekdays.length === 0) {
        weekdayError.classList.remove('hidden');
        isValid = false;
      }
    }

    if (!isValid) return;

    // Construct scheduled timestamp
    const [year, month, day] = dateVal.split('-').map(Number);
    const [hours, minutes] = timeVal.split(':').map(Number);
    const scheduledDate = new Date(year, month - 1, day, hours, minutes);

    const reminderPayload = {
      id: formId.value || undefined,
      title,
      description: formDesc.value.trim() || null,
      scheduled_at: scheduledDate.toISOString(),
      timezone: activeTimezone,
      recurrence_type: recurrence,
      recurrence_days: recurrence === 'weekly' ? selectedWeekdays : null,
      recurrence_month_day: recurrence === 'monthly' ? parseInt(formMonthDay.value, 10) : null
    };

    btnSaveReminder.disabled = true;
    try {
      await window.ReminderStore.save(reminderPayload);
      closeModal();
      renderDashboard();
      showToast(formId.value ? 'Reminder updated successfully.' : 'New reminder created successfully.');
    } catch (err) {
      showToast(`Error saving reminder: ${err.message}`, 'error');
    } finally {
      btnSaveReminder.disabled = false;
    }
  });

  // --- Rendering UI ---
  function formatScheduleTime(isoString) {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (e) {
      return isoString;
    }
  }

  function getRecurrenceLabel(r) {
    if (!r.recurrence_type || r.recurrence_type === 'none') return null;
    if (r.recurrence_type === 'daily') return 'Repeats Daily';
    if (r.recurrence_type === 'weekly') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = (r.recurrence_days || []).map(d => dayNames[d]).join(', ');
      return `Weekly on ${days || 'selected days'}`;
    }
    if (r.recurrence_type === 'monthly') {
      return `Monthly on day ${r.recurrence_month_day || 1}`;
    }
    return 'Recurring';
  }

  function renderSummaryCounts() {
    const counts = window.ReminderStore.getCounts();
    countToday.textContent = counts.today;
    countUpcoming.textContent = counts.upcoming;
    countOverdue.textContent = counts.overdue;
    countCompleted.textContent = counts.completed;
  }

  function renderRemindersList() {
    const allReminders = window.ReminderStore.getCached();
    let filtered = allReminders;

    if (currentFilter === 'today') {
      filtered = allReminders.filter(r => r.status !== 'completed' && window.ReminderStore.getCategory(r) === 'today');
    } else if (currentFilter === 'upcoming') {
      filtered = allReminders.filter(r => r.status !== 'completed' && window.ReminderStore.getCategory(r) === 'upcoming');
    } else if (currentFilter === 'overdue') {
      filtered = allReminders.filter(r => r.status !== 'completed' && window.ReminderStore.getCategory(r) === 'overdue');
    } else if (currentFilter === 'completed') {
      filtered = allReminders.filter(r => r.status === 'completed');
    } else if (currentFilter === 'recurring') {
      filtered = allReminders.filter(r => r.recurrence_type && r.recurrence_type !== 'none');
    }

    filterDisplayCount.textContent = filtered.length;
    remindersContainer.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      emptyStateDesc.textContent = `No ${currentFilter === 'all' ? '' : currentFilter + ' '}reminders found. Click below to create one.`;
      return;
    }

    emptyState.classList.add('hidden');

    filtered.forEach(item => {
      const card = document.createElement('article');
      const isCompleted = item.status === 'completed';
      const category = window.ReminderStore.getCategory(item);
      const recurrenceLabel = getRecurrenceLabel(item);

      card.className = `reminder-card ${isCompleted ? 'completed' : ''}`;
      card.setAttribute('data-id', item.id);

      let badgeHtml = '';
      if (isCompleted) {
        badgeHtml = '<span class="badge badge-completed">Completed</span>';
      } else if (category === 'overdue') {
        badgeHtml = '<span class="badge badge-overdue">Overdue</span>';
      } else if (category === 'today') {
        badgeHtml = '<span class="badge badge-today">Today</span>';
      } else {
        badgeHtml = '<span class="badge badge-upcoming">Upcoming</span>';
      }

      const recurrenceBadge = recurrenceLabel 
        ? `<span class="badge badge-recurring" title="${recurrenceLabel}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            ${item.recurrence_type}
           </span>` 
        : '';

      const demoBadge = item.is_demo 
        ? `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-size: 0.65rem;" title="Demo Data">Demo</span>`
        : '';

      let nextRunText = '';
      if (!isCompleted && item.recurrence_type && item.recurrence_type !== 'none' && window.RecurrenceEngine) {
        try {
          const nextDate = window.RecurrenceEngine.calculateNextOccurrence({
            scheduledAt: item.scheduled_at,
            timezone: item.timezone || activeTimezone,
            recurrenceType: item.recurrence_type,
            recurrenceDays: item.recurrence_days,
            recurrenceMonthDay: item.recurrence_month_day
          });
          if (nextDate) {
            nextRunText = `Next: ${formatScheduleTime(nextDate.toISOString())}`;
          }
        } catch (e) {}
      }

      card.innerHTML = `
        <div class="reminder-left">
          <button type="button" class="reminder-check-btn" title="${isCompleted ? 'Mark Active' : 'Mark Completed'}" aria-label="Toggle completion">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <div class="reminder-content">
            <div class="reminder-header-line">
              <span class="reminder-title">${escapeHtml(item.title)}</span>
              ${badgeHtml}
              ${recurrenceBadge}
              ${demoBadge}
            </div>
            ${item.description ? `<p class="reminder-desc">${escapeHtml(item.description)}</p>` : ''}
            <div class="reminder-meta">
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>${formatScheduleTime(item.scheduled_at)}</span>
              </span>
              ${recurrenceLabel ? `<span class="meta-item font-mono" style="font-size: 0.75rem;">(${recurrenceLabel})</span>` : ''}
              ${nextRunText ? `<span class="meta-item" style="color: var(--primary); font-size: 0.75rem;">${nextRunText}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="reminder-actions">
          ${!isCompleted ? `
            <button type="button" class="btn btn-secondary btn-sm btn-action-snooze" title="Snooze reminder">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Snooze</span>
            </button>
          ` : ''}
          <button type="button" class="btn-icon btn-action-edit" title="Edit reminder" aria-label="Edit reminder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button type="button" class="btn-icon btn-action-delete" title="Delete reminder" aria-label="Delete reminder" style="color: var(--danger);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      const checkBtn = card.querySelector('.reminder-check-btn');
      checkBtn.addEventListener('click', async () => {
        try {
          await window.ReminderStore.toggleComplete(item.id);
          renderDashboard();
          showToast(isCompleted ? 'Reminder marked as active.' : 'Reminder completed.');
        } catch (err) {
          showToast(`Action failed: ${err.message}`, 'error');
        }
      });

      const snoozeBtn = card.querySelector('.btn-action-snooze');
      if (snoozeBtn) {
        snoozeBtn.addEventListener('click', () => {
          openSnoozeModal(item.id, item.title);
        });
      }

      const editBtn = card.querySelector('.btn-action-edit');
      editBtn.addEventListener('click', () => {
        openEditModal(item.id);
      });

      const deleteBtn = card.querySelector('.btn-action-delete');
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
          try {
            await window.ReminderStore.remove(item.id);
            renderDashboard();
            showToast('Reminder deleted.');
          } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
          }
        }
      });

      remindersContainer.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function renderDashboard() {
    renderSummaryCounts();
    renderRemindersList();
  }

  // --- Filter Tabs Click Handlers ---
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      
      summaryCards.forEach(c => {
        if (c.dataset.filter === currentFilter) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });

      renderRemindersList();
    });
  });

  summaryCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter;
      filterTabs.forEach(t => {
        if (t.dataset.filter === filter) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      summaryCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentFilter = filter;
      renderRemindersList();
    });
  });

  // --- Settings Form Submit ---
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = settingEmail.value.trim();
      const tz = settingTimezone.value;

      if (!email) {
        showToast('Please enter a valid destination email.', 'error');
        return;
      }

      activeTimezone = tz;
      if (currentTzLabel) currentTzLabel.textContent = tz;
      updateClock();

      if (isLiveAuth && currentUser && currentUser.id) {
        try {
          await window.SupabaseModule.updateProfile(currentUser.id, {
            destination_email: email,
            timezone: tz
          });
          showToast(`Preferences saved to your Supabase profile. Timezone updated to ${tz}.`, 'success');
        } catch (err) {
          showToast(`Error updating profile: ${err.message}`, 'error');
        }
      } else {
        showToast(`Preferences saved locally. Timezone updated to ${tz}.`, 'success');
      }

      setTimeout(() => {
        switchView('reminders');
        renderDashboard();
      }, 500);
    });
  }

  // Initial Boot: fetch profile and load reminders from database
  if (loadingState) loadingState.classList.remove('hidden');
  try {
    await loadUserProfile();
    await window.ReminderStore.fetchAll();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
  } finally {
    if (loadingState) loadingState.classList.add('hidden');
  }

  renderDashboard();
})();
