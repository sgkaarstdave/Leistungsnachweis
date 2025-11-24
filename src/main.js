import { supabase } from './state/supabaseClient.js';
import { DEFAULT_HOURLY_RATE } from './config/settings.js';
import { exportToExcel } from './export/excelExport.js';

const state = {
  session: null,
  trainers: [],
  teams: [],
  entries: [],
  filters: {
    month: new Date().toISOString().slice(0, 7),
    trainerId: '',
  },
  authMode: 'login',
  editingTrainerId: null,
  editingTeamId: null,
  editingTeamActive: true,
};

const elements = {
  authSection: document.getElementById('auth-section'),
  appSection: document.getElementById('app-section'),
  loginForm: document.getElementById('login-form'),
  loginSubmit: document.getElementById('login-submit'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginFeedback: document.getElementById('login-feedback'),
  toggleMode: document.getElementById('toggle-mode'),
  currentUser: document.getElementById('current-user'),
  sessionDetails: document.getElementById('session-details'),
  signOut: document.getElementById('sign-out'),
  statusMessage: document.getElementById('status-message'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  panels: document.querySelectorAll('.panel'),
  entryForm: document.getElementById('entry-form'),
  entryDate: document.getElementById('entry-date'),
  entryTeam: document.getElementById('entry-team'),
  entryTeamHint: document.getElementById('entry-team-hint'),
  entryTrainer: document.getElementById('entry-trainer'),
  entryActivity: document.getElementById('entry-activity'),
  startTime: document.getElementById('start-time'),
  endTime: document.getElementById('end-time'),
  hourlyRateInfo: document.getElementById('hourly-rate-info'),
  entryNotes: document.getElementById('entry-notes'),
  entryFeedback: document.getElementById('entry-feedback'),
  entrySubmit: document.querySelector('#entry-form button[type="submit"]'),
  durationDisplay: document.getElementById('duration-display'),
  costDisplay: document.getElementById('cost-display'),
  filterMonth: document.getElementById('filter-month'),
  filterTrainer: document.getElementById('filter-trainer'),
  exportExcel: document.getElementById('export-excel'),
  entriesBody: document.getElementById('entries-body'),
  totalMinutes: document.getElementById('total-minutes'),
  totalHours: document.getElementById('total-hours'),
  totalCost: document.getElementById('total-cost'),
  trainerForm: document.getElementById('trainer-form'),
  trainerId: document.getElementById('trainer-id'),
  trainerName: document.getElementById('trainer-name'),
  trainerEmail: document.getElementById('trainer-email'),
  trainerActive: document.getElementById('trainer-active'),
  trainerSubmit: document.getElementById('trainer-submit'),
  trainerReset: document.getElementById('trainer-reset'),
  trainerFeedback: document.getElementById('trainer-feedback'),
  trainerList: document.getElementById('trainer-list'),
  teamForm: document.getElementById('team-form'),
  teamId: document.getElementById('team-id'),
  teamName: document.getElementById('team-name'),
  teamTrainer: document.getElementById('team-trainer'),
  teamScheduleList: document.getElementById('team-schedule-list'),
  addTeamSlot: document.getElementById('add-team-slot'),
  teamSubmit: document.getElementById('team-submit'),
  teamReset: document.getElementById('team-reset'),
  teamFeedback: document.getElementById('team-feedback'),
  teamList: document.getElementById('team-list'),
};

init();

async function init() {
  disableServiceWorkers();
  setDefaultDates();
  setHourlyRateInfo();
  bindEvents();
  updateTeamValidationState();
  renderScheduleRows();
  await restoreSession();
}

function disableServiceWorkers() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      })
      .catch((error) => {
        console.warn('Konnte Service Worker nicht deregistrieren', error);
      });
  }
}

function setDefaultDates(preserveFilter = false) {
  const today = new Date().toISOString().slice(0, 10);
  elements.entryDate.value = today;
  if (!preserveFilter) {
    elements.filterMonth.value = state.filters.month;
  }
}

function setHourlyRateInfo() {
  if (elements.hourlyRateInfo) {
    elements.hourlyRateInfo.textContent = formatCurrency(DEFAULT_HOURLY_RATE);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleAuthSubmit);
  elements.toggleMode.addEventListener('click', toggleAuthMode);
  elements.signOut.addEventListener('click', handleSignOut);

  elements.tabButtons.forEach((btn) =>
    btn.addEventListener('click', () => switchPanel(btn.dataset.target))
  );

  elements.entryForm.addEventListener('submit', handleEntrySubmit);
  [elements.startTime, elements.endTime].forEach((el) =>
    el.addEventListener('input', () => {
      updateComputedFields();
      updateTeamValidationState();
    })
  );
  elements.entryTeam.addEventListener('change', () => {
    applyTeamDefaults();
    updateTeamValidationState();
  });
  elements.entryTrainer.addEventListener('change', () => {
    updateComputedFields();
    updateTeamValidationState();
  });
  elements.entryDate.addEventListener('change', () => {
    applyTeamDefaults();
    updateTeamValidationState();
  });
  elements.entryActivity.addEventListener('change', () => updateTeamValidationState());

  elements.filterMonth.addEventListener('change', handleFilterChange);
  elements.filterTrainer.addEventListener('change', handleFilterChange);
  elements.exportExcel?.addEventListener('click', handleExportExcel);

  elements.trainerForm.addEventListener('submit', handleTrainerSubmit);
  elements.trainerReset.addEventListener('click', resetTrainerForm);

  elements.teamForm.addEventListener('submit', handleTeamSubmit);
  elements.teamReset.addEventListener('click', resetTeamForm);
  elements.addTeamSlot.addEventListener('click', () => addScheduleRow());
}

async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showFeedback(elements.loginFeedback, 'Konnte Session nicht prüfen.', true);
    return;
  }
  handleSessionChange(data.session);
  supabase.auth.onAuthStateChange((_event, session) => handleSessionChange(session));
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'login' ? 'register' : 'login';
  elements.toggleMode.textContent =
    state.authMode === 'login' ? 'Konto erstellen' : 'Schon angemeldet?';
  elements.loginSubmit.textContent =
    state.authMode === 'login' ? 'Anmelden' : 'Registrieren';
  showFeedback(elements.loginFeedback, '');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  showFeedback(elements.loginFeedback, '');
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value.trim();

  if (!email || !password) {
    showFeedback(elements.loginFeedback, 'Bitte E-Mail und Passwort eingeben.', true);
    return;
  }

  setStatus('');
  elements.loginForm.classList.add('loading');

  const authFn =
    state.authMode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

  const { error } = await authFn;
  elements.loginForm.classList.remove('loading');

  if (error) {
    showFeedback(elements.loginFeedback, error.message, true);
    return;
  }

  showFeedback(
    elements.loginFeedback,
    state.authMode === 'login'
      ? 'Anmeldung erfolgreich.'
      : 'Konto erstellt. Bitte Posteingang prüfen, falls eine Bestätigung nötig ist.'
  );
}

async function handleSignOut() {
  await supabase.auth.signOut();
  state.entries = [];
  renderEntries();
  setStatus('Abgemeldet.');
}

function handleSessionChange(session) {
  state.session = session;
  const isLoggedIn = Boolean(session);
  elements.authSection.classList.toggle('hidden', isLoggedIn);
  elements.appSection.classList.toggle('hidden', !isLoggedIn);
  elements.sessionDetails.classList.toggle('hidden', !isLoggedIn);

  if (isLoggedIn) {
    elements.currentUser.textContent = session.user.email;
    refreshData();
  } else {
    elements.currentUser.textContent = '';
  }
}

async function refreshData() {
  await loadTrainers();
  await loadTeams();
  await loadEntries();
  updateComputedFields();
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  if (!state.session) return;

  const hasTeam = updateTeamValidationState(true);
  if (!hasTeam) {
    showFeedback(elements.entryFeedback, 'Bitte eine Mannschaft auswählen.', true);
    return;
  }

  const payload = buildEntryPayload();
  if (!payload) return;

  const { isDuplicate, error: duplicateError } = await checkDuplicateEntry(payload);
  if (duplicateError) {
    console.error('Supabase error', duplicateError);
    showFeedback(
      elements.entryFeedback,
      'Konnte bestehende Einträge nicht prüfen: ' + duplicateError.message,
      true
    );
    return;
  }

  if (isDuplicate) {
    showFeedback(
      elements.entryFeedback,
      'Für diese Kombination aus Trainer, Mannschaft und Datum existiert bereits ein Eintrag.',
      true
    );
    return;
  }

  const { hasConflict, error: conflictError } = await checkTimeConflict(payload);
  if (conflictError) {
    console.error('Supabase error', conflictError);
    showFeedback(
      elements.entryFeedback,
      'Konnte Zeitüberschneidungen nicht prüfen: ' + conflictError.message,
      true
    );
    return;
  }

  if (hasConflict) {
    showFeedback(
      elements.entryFeedback,
      'Für dieses Datum existiert bereits ein Eintrag mit überschneidenden Zeiten.',
      true
    );
    return;
  }

  elements.entryForm.classList.add('loading');
  const { error } = await supabase.from('performance_entries').insert({
    ...payload,
    created_by: state.session.user.id,
  });
  elements.entryForm.classList.remove('loading');

  if (error) {
    console.error('Supabase error', error);
    const duplicateViolation = isDuplicateEntryError(error);
    const message = duplicateViolation
      ? 'Für diese Kombination aus Trainer, Mannschaft und Datum existiert bereits ein Eintrag.'
      : error.message;
    showFeedback(elements.entryFeedback, message, true);
    return;
  }

  showFeedback(elements.entryFeedback, 'Eintrag gespeichert.');
  elements.entryForm.reset();
  setDefaultDates(true);
  elements.entryTeam.value = '';
  updateTeamValidationState();
  updateComputedFields();
  await loadEntries();
}

function buildEntryPayload() {
  const date = elements.entryDate.value;
  const teamId = elements.entryTeam.value;
  const trainerId = elements.entryTrainer.value;
  const start = elements.startTime.value;
  const end = elements.endTime.value;

  const hasTeam = updateTeamValidationState(true);
  if (!hasTeam) {
    showFeedback(elements.entryFeedback, 'Bitte eine Mannschaft auswählen.', true);
    return null;
  }

  if (!date || !trainerId || !start || !end) {
    showFeedback(elements.entryFeedback, 'Bitte alle Pflichtfelder ausfüllen.', true);
    return null;
  }

  const durationMinutes = calculateDuration(start, end);
  if (durationMinutes <= 0) {
    showFeedback(elements.entryFeedback, 'Endzeit muss nach der Startzeit liegen.', true);
    return null;
  }

  const cost = Number(((durationMinutes / 60) * DEFAULT_HOURLY_RATE).toFixed(2));

  return {
    trainer_id: trainerId,
    team_id: teamId,
    date,
    start_time: start,
    end_time: end,
    duration_minutes: durationMinutes,
    activity: elements.entryActivity.value.trim(),
    notes: elements.entryNotes.value.trim(),
    hourly_rate: DEFAULT_HOURLY_RATE,
    cost,
  };
}

async function checkDuplicateEntry(payload) {
  const { trainer_id: trainerId, team_id: teamId, date } = payload;
  if (!teamId) {
    return { error: null, isDuplicate: false };
  }
  let query = supabase
    .from('performance_entries')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('date', date)
    .limit(1);

  query = teamId ? query.eq('team_id', teamId) : query.is('team_id', null);

  const { error, count } = await query;
  return {
    error,
    isDuplicate: typeof count === 'number' ? count > 0 : false,
  };
}

async function checkTimeConflict(payload) {
  const { date, start_time: startTime, end_time: endTime } = payload;
  const { error, count } = await supabase
    .from('performance_entries')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1);

  return {
    error,
    hasConflict: typeof count === 'number' ? count > 0 : false,
  };
}

function calculateDuration(start, end) {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : 0;
}

function updateTeamValidationState(showError = false) {
  const hasTeam = Boolean(elements.entryTeam.value);
  const hasDate = Boolean(elements.entryDate.value);
  const hasTrainer = Boolean(elements.entryTrainer.value);
  const hasActivity = Boolean(elements.entryActivity.value);
  const hasStart = Boolean(elements.startTime.value);
  const hasEnd = Boolean(elements.endTime.value);
  const isComplete = hasTeam && hasDate && hasTrainer && hasActivity && hasStart && hasEnd;

  if (elements.entrySubmit) {
    elements.entrySubmit.disabled = !isComplete;
  }
  toggleTeamValidationError(showError && !hasTeam);
  return hasTeam;
}

function toggleTeamValidationError(show) {
  elements.entryTeam.classList.toggle('field-error', show);
  elements.entryTeamHint?.classList.toggle('hidden', !show);
}

async function loadTrainers() {
  if (!state.session) return;
  const { data, error } = await supabase
    .from('trainers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Trainer nicht laden: ' + error.message, 'error');
    return;
  }

  state.trainers = data || [];
  populateTrainerSelects();
  renderTrainerList();
}

function populateTrainerSelects() {
  const activeTrainers = state.trainers.filter((t) => t.is_active !== false);
  elements.entryTrainer.innerHTML = '';
  if (activeTrainers.length === 0) {
    elements.entryTrainer.innerHTML = '<option value="">Bitte Trainer anlegen</option>';
  } else {
    activeTrainers.forEach((trainer) => {
      const option = document.createElement('option');
      option.value = trainer.id;
      option.textContent = trainer.name;
      elements.entryTrainer.appendChild(option);
    });
  }

  elements.teamTrainer.innerHTML = '';
  const teamTrainerPlaceholder = document.createElement('option');
  teamTrainerPlaceholder.value = '';
  teamTrainerPlaceholder.textContent = 'Ohne Trainer';
  elements.teamTrainer.appendChild(teamTrainerPlaceholder);
  state.trainers.forEach((trainer) => {
    const option = document.createElement('option');
    option.value = trainer.id;
    option.textContent = `${trainer.name}${trainer.is_active === false ? ' (inaktiv)' : ''}`;
    elements.teamTrainer.appendChild(option);
  });

  elements.filterTrainer.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Alle Trainer';
  elements.filterTrainer.appendChild(allOption);
  state.trainers.forEach((trainer) => {
    const option = document.createElement('option');
    option.value = trainer.id;
    option.textContent = `${trainer.name}${trainer.is_active === false ? ' (inaktiv)' : ''}`;
    elements.filterTrainer.appendChild(option);
  });
}

function renderTrainerList() {
  elements.trainerList.innerHTML = '';
  if (!state.trainers.length) {
    elements.trainerList.innerHTML = '<p class="muted">Noch keine Trainer hinterlegt.</p>';
    return;
  }

  state.trainers.forEach((trainer) => {
    const item = document.createElement('div');
    item.className = 'trainer-item';
    item.innerHTML = `
      <div>
        <strong>${trainer.name}</strong>
        <p class="muted small">${trainer.email || 'Keine E-Mail hinterlegt'}</p>
      </div>
      <div class="trainer-meta">
        <span class="pill ${trainer.is_active === false ? 'pill-danger' : 'pill-success'}">${
      trainer.is_active === false ? 'Inaktiv' : 'Aktiv'
    }</span>
        <span class="pill">${formatCurrency(DEFAULT_HOURLY_RATE)} / Std.</span>
        <button class="ghost" data-action="edit" data-id="${trainer.id}">Bearbeiten</button>
        <button class="secondary" data-action="toggle" data-id="${trainer.id}">${
      trainer.is_active === false ? 'Aktivieren' : 'Deaktivieren'
    }</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener('click', () => startEditTrainer(trainer));
    item.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTrainer(trainer));

    elements.trainerList.appendChild(item);
  });
}

function startEditTrainer(trainer) {
  state.editingTrainerId = trainer.id;
  elements.trainerId.value = trainer.id;
  elements.trainerName.value = trainer.name || '';
  elements.trainerEmail.value = trainer.email || '';
  elements.trainerActive.checked = trainer.is_active !== false;
  elements.trainerSubmit.textContent = 'Trainer aktualisieren';
  showFeedback(elements.trainerFeedback, `Bearbeitung von ${trainer.name}`);
}

async function toggleTrainer(trainer) {
  const { error } = await supabase
    .from('trainers')
    .update({ is_active: trainer.is_active === false, updated_at: new Date().toISOString() })
    .eq('id', trainer.id);

  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Status nicht ändern: ' + error.message, 'error');
    return;
  }
  setStatus(`Status für ${trainer.name} angepasst.`);
  await loadTrainers();
  await loadTeams();
  await loadEntries();
}

async function handleTrainerSubmit(event) {
  event.preventDefault();
  if (!state.session) return;

  const payload = {
    name: elements.trainerName.value.trim(),
    email: elements.trainerEmail.value.trim() || null,
    hourly_rate: DEFAULT_HOURLY_RATE,
    is_active: elements.trainerActive.checked,
    created_by: state.session.user.id,
  };

  if (!payload.name) {
    showFeedback(elements.trainerFeedback, 'Bitte Name angeben.', true);
    return;
  }

  elements.trainerForm.classList.add('loading');
  const query = state.editingTrainerId
    ? supabase.from('trainers').update(payload).eq('id', state.editingTrainerId)
    : supabase.from('trainers').insert(payload);

  const { error } = await query;
  elements.trainerForm.classList.remove('loading');

  if (error) {
    console.error('Supabase error', error);
    showFeedback(elements.trainerFeedback, error.message, true);
    return;
  }

  showFeedback(
    elements.trainerFeedback,
    state.editingTrainerId ? 'Trainer aktualisiert.' : 'Trainer angelegt.'
  );
  resetTrainerForm();
  await loadTrainers();
  await loadTeams();
  await loadEntries();
}

function resetTrainerForm() {
  state.editingTrainerId = null;
  elements.trainerId.value = '';
  elements.trainerForm.reset();
  elements.trainerActive.checked = true;
  elements.trainerSubmit.textContent = 'Trainer speichern';
  showFeedback(elements.trainerFeedback, '');
}

function renderScheduleRows(schedule = []) {
  elements.teamScheduleList.innerHTML = '';
  const rows = schedule.length ? schedule : [{}];
  rows.forEach((slot) => addScheduleRow(slot));
}

function addScheduleRow(slot = {}) {
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.dataset.isActive = slot.is_active === false ? 'false' : 'true';

  const dayInput = document.createElement('input');
  dayInput.type = 'text';
  dayInput.placeholder = 'z.B. Mittwoch';
  dayInput.value = slot.day || '';
  dayInput.className = 'team-day';

  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.value = slot.start?.slice(0, 5) || '';
  startInput.className = 'team-start';

  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.value = slot.end?.slice(0, 5) || '';
  endInput.className = 'team-end';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'ghost';
  removeBtn.textContent = 'Entfernen';
  removeBtn.addEventListener('click', () => {
    row.remove();
    if (!elements.teamScheduleList.children.length) {
      renderScheduleRows();
    }
  });

  row.append(dayInput, startInput, endInput, removeBtn);
  elements.teamScheduleList.appendChild(row);
}

function collectTrainingSchedule() {
  const rows = Array.from(elements.teamScheduleList.querySelectorAll('.schedule-row'));
  return rows
    .map((row) => {
      const day = row.querySelector('.team-day')?.value.trim();
      const start = row.querySelector('.team-start')?.value || '';
      const end = row.querySelector('.team-end')?.value || '';
      const is_active = row.dataset.isActive !== 'false';
      return { day, start, end, is_active };
    })
    .filter((slot) => slot.day || slot.start || slot.end);
}

function normalizeTeamSchedule(team) {
  const schedule = Array.isArray(team.training_schedule) ? team.training_schedule : [];
  if (!schedule.length && (team.default_day || team.default_start_time || team.default_end_time)) {
    schedule.push({
      day: team.default_day || '',
      start: team.default_start_time?.slice(0, 5) || '',
      end: team.default_end_time?.slice(0, 5) || '',
      is_active: true,
    });
  }
  const normalizedSchedule = schedule.map((slot) => ({
    ...slot,
    is_active: slot.is_active !== false,
  }));
  return { ...team, training_schedule: normalizedSchedule };
}

function formatSchedule(schedule = []) {
  const activeSlots = schedule.filter((slot) => slot.is_active !== false);
  if (!activeSlots.length) return 'Kein Standardtermin';
  return activeSlots
    .map((slot) => {
      const times = [slot.start, slot.end].filter(Boolean).map((time) => time.slice(0, 5)).join(' - ');
      return `${slot.day || 'Tag offen'}${times ? ` ${times}` : ''}`;
    })
    .join(' • ');
}

function getPreferredSlot(team) {
  if (!team?.training_schedule?.length) return null;
  const activeSchedule = team.training_schedule.filter((slot) => slot.is_active !== false);
  if (!activeSchedule.length) return null;
  const dateValue = elements.entryDate.value;
  if (dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const weekday = date.toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase();
      const matched = activeSchedule.find(
        (slot) => slot.day?.toLowerCase() === weekday
      );
      if (matched) return matched;
    }
  }
  return activeSchedule[0];
}

async function loadTeams() {
  if (!state.session) return;
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error', error);
    const hint = error.message?.includes('Could not find the table')
      ? ' Bitte das SQL-Skript supabase/teams.sql im Supabase-Editor ausführen.'
      : '';
    setStatus('Konnte Mannschaften nicht laden: ' + error.message + hint, 'error');
    return;
  }

  state.teams = (data || []).map(normalizeTeamSchedule);
  populateTeamSelect();
  renderTeamList();
}

function populateTeamSelect() {
  elements.entryTeam.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Bitte Mannschaft wählen';
  emptyOption.disabled = true;
  emptyOption.selected = true;
  elements.entryTeam.appendChild(emptyOption);

  const activeTeams = state.teams.filter((team) => team.is_active !== false);
  activeTeams.forEach((team) => {
    const trainer = state.trainers.find((t) => t.id === team.trainer_id);
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = `${team.name}${trainer ? ` (Trainer: ${trainer.name})` : ''}`;
    elements.entryTeam.appendChild(option);
  });
  updateTeamValidationState();
}

function renderTeamList() {
  elements.teamList.innerHTML = '';
  if (!state.teams.length) {
    elements.teamList.innerHTML = '<p class="muted">Noch keine Mannschaften hinterlegt.</p>';
    return;
  }

  state.teams.forEach((team) => {
    const trainer = state.trainers.find((t) => t.id === team.trainer_id);
    const isActive = team.is_active !== false;
    const item = document.createElement('div');
    item.className = 'trainer-item';
    const schedule = formatSchedule(team.training_schedule);

    item.innerHTML = `
      <div>
        <strong>${team.name}</strong>
        <p class="muted small">${trainer ? trainer.name : 'Ohne Trainer'}</p>
        <p class="muted small">${schedule}</p>
      </div>
      <div class="trainer-meta">
        <label class="toggle-switch" data-id="${team.id}">
          <input type="checkbox" data-action="toggle" ${isActive ? 'checked' : ''} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label">${isActive ? 'Aktiv' : 'Inaktiv'}</span>
        </label>
        <button class="ghost" data-action="edit" data-id="${team.id}">Bearbeiten</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener('click', () => startEditTeam(team));
    item
      .querySelector('[data-action="toggle"]')
      .addEventListener('change', (event) => handleTeamToggle(team, event.target.checked));

    elements.teamList.appendChild(item);
  });
}

function startEditTeam(team) {
  state.editingTeamId = team.id;
  state.editingTeamActive = team.is_active !== false;
  elements.teamId.value = team.id;
  elements.teamName.value = team.name || '';
  elements.teamTrainer.value = team.trainer_id || '';
  renderScheduleRows(team.training_schedule);
  elements.teamSubmit.textContent = 'Mannschaft aktualisieren';
  showFeedback(elements.teamFeedback, `Bearbeitung von ${team.name}`);
}

async function handleTeamToggle(team, isActive) {
  const { error } = await supabase
    .from('teams')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', team.id);

  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Status nicht ändern: ' + error.message, 'error');
    return;
  }

  if (state.editingTeamId === team.id) {
    state.editingTeamActive = isActive;
  }

  setStatus(`Status für ${team.name} angepasst.`);
  await loadTeams();
  await loadEntries();
}

async function handleTeamSubmit(event) {
  event.preventDefault();
  if (!state.session) return;

  const trainingSchedule = collectTrainingSchedule();
  const primarySlot = trainingSchedule[0] || {};

  const payload = {
    name: elements.teamName.value.trim(),
    trainer_id: elements.teamTrainer.value || null,
    training_schedule: trainingSchedule,
    default_day: primarySlot.day || null,
    default_start_time: primarySlot.start || null,
    default_end_time: primarySlot.end || null,
    is_active: state.editingTeamId ? state.editingTeamActive : true,
    created_by: state.session.user.id,
  };

  if (!payload.name) {
    showFeedback(elements.teamFeedback, 'Bitte Name angeben.', true);
    return;
  }

  elements.teamForm.classList.add('loading');
  const query = state.editingTeamId
    ? supabase
        .from('teams')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', state.editingTeamId)
    : supabase.from('teams').insert(payload);

  const { error } = await query;
  elements.teamForm.classList.remove('loading');

  if (error) {
    console.error('Supabase error', error);
    showFeedback(elements.teamFeedback, error.message, true);
    return;
  }

  showFeedback(
    elements.teamFeedback,
    state.editingTeamId ? 'Mannschaft aktualisiert.' : 'Mannschaft angelegt.'
  );
  await loadTeams();
  resetTeamForm();
}

function resetTeamForm() {
  state.editingTeamId = null;
  state.editingTeamActive = true;
  elements.teamId.value = '';
  elements.teamForm.reset();
  elements.teamSubmit.textContent = 'Mannschaft speichern';
  renderScheduleRows();
  showFeedback(elements.teamFeedback, '');
}

function applyTeamDefaults() {
  const selectedTeam = state.teams.find((team) => team.id === elements.entryTeam.value);
  if (selectedTeam) {
    if (selectedTeam.trainer_id) {
      elements.entryTrainer.value = selectedTeam.trainer_id;
    }
    const slot = getPreferredSlot(selectedTeam);
    if (slot?.start) {
      elements.startTime.value = slot.start.slice(0, 5);
    }
    if (slot?.end) {
      elements.endTime.value = slot.end.slice(0, 5);
    }
  }
  updateComputedFields();
}

async function loadEntries() {
  if (!state.session) return;
  let query = supabase
    .from('performance_entries')
    .select('*')
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });

  if (state.filters.month) {
    const { start, end } = monthRange(state.filters.month);
    query = query.gte('date', start).lte('date', end);
  }

  if (state.filters.trainerId) {
    query = query.eq('trainer_id', state.filters.trainerId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Einträge nicht laden: ' + error.message, 'error');
    return;
  }

  state.entries = data || [];
  renderEntries();
}

function renderEntries() {
  elements.entriesBody.innerHTML = '';
  if (!state.entries.length) {
    elements.entriesBody.innerHTML = '<tr><td colspan="10" class="empty">Keine Einträge gefunden.</td></tr>';
    updateMetrics();
    return;
  }

  state.entries.forEach((entry) => {
    const trainer = state.trainers.find((t) => t.id === entry.trainer_id);
    const team = state.teams.find((t) => t.id === entry.team_id);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(entry.date)}</td>
      <td>${entry.start_time?.slice(0, 5) || ''}</td>
      <td>${entry.end_time?.slice(0, 5) || ''}</td>
      <td>${formatDuration(entry.duration_minutes)}</td>
      <td>${trainer ? trainer.name : '–'}</td>
      <td>${team ? team.name : '–'}</td>
      <td>${entry.activity || '–'}</td>
      <td>${formatCurrency(entry.cost || 0)}</td>
      <td class="notes">${entry.notes || ''}</td>
      <td><button class="ghost" data-id="${entry.id}">Löschen</button></td>
    `;

    row.querySelector('button').addEventListener('click', () => deleteEntry(entry.id));
    elements.entriesBody.appendChild(row);
  });

  updateMetrics();
}

async function deleteEntry(id) {
  const { error } = await supabase.from('performance_entries').delete().eq('id', id);
  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Eintrag nicht löschen: ' + error.message, 'error');
    return;
  }
  setStatus('Eintrag gelöscht.');
  await loadEntries();
}

function handleFilterChange() {
  state.filters.month = elements.filterMonth.value;
  state.filters.trainerId = elements.filterTrainer.value;
  loadEntries();
}

async function handleExportExcel() {
  if (!state.session || !elements.exportExcel) return;

  elements.exportExcel.disabled = true;
  const previousLabel = elements.exportExcel.textContent;
  elements.exportExcel.textContent = 'Export läuft...';
  setStatus('');

  const { exportedFiles = 0, totalEntries = 0, error } = await exportToExcel({
    supabase,
    filters: { ...state.filters },
  });

  if (error) {
    setStatus('Konnte Export nicht durchführen: ' + error.message, 'error');
  } else if (!totalEntries) {
    setStatus('Keine Einträge für den Export gefunden.', 'info');
  } else {
    const suffix = exportedFiles === 1 ? '' : 'en';
    setStatus(`Export abgeschlossen (${exportedFiles} Datei${suffix}).`);
  }

  elements.exportExcel.disabled = false;
  elements.exportExcel.textContent = previousLabel;
}

function switchPanel(targetId) {
  elements.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.target === targetId));
  elements.panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

function updateComputedFields() {
  const start = elements.startTime.value;
  const end = elements.endTime.value;
  if (!start || !end) {
    elements.durationDisplay.textContent = '0 min';
    elements.costDisplay.textContent = formatCurrency(0);
    return;
  }

  const minutes = calculateDuration(start, end);
  const cost = Number(((minutes / 60) * DEFAULT_HOURLY_RATE).toFixed(2));

  elements.durationDisplay.textContent = `${minutes} min`;
  elements.costDisplay.textContent = formatCurrency(cost);
}

function updateMetrics() {
  const totalMinutes = state.entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const totalCost = state.entries.reduce((sum, e) => sum + Number(e.cost || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  elements.totalMinutes.textContent = totalMinutes;
  elements.totalHours.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
  elements.totalCost.textContent = formatCurrency(totalCost);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '–';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest} min`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function monthRange(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = `${monthValue}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function isDuplicateEntryError(error) {
  return (
    error?.code === '23505' ||
    error?.message?.includes('performance_entries_trainer_team_date_unique')
  );
}

function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function setStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.type = type;
}
