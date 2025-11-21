import { supabase } from './state/supabaseClient.js';
import { DEFAULT_HOURLY_RATE } from './config/settings.js';

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
  entryTrainer: document.getElementById('entry-trainer'),
  entryActivity: document.getElementById('entry-activity'),
  startTime: document.getElementById('start-time'),
  endTime: document.getElementById('end-time'),
  hourlyRateDisplay: document.getElementById('hourly-rate-display'),
  entryNotes: document.getElementById('entry-notes'),
  entryFeedback: document.getElementById('entry-feedback'),
  durationDisplay: document.getElementById('duration-display'),
  costDisplay: document.getElementById('cost-display'),
  filterMonth: document.getElementById('filter-month'),
  filterTrainer: document.getElementById('filter-trainer'),
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
  teamDay: document.getElementById('team-day'),
  teamStart: document.getElementById('team-start'),
  teamEnd: document.getElementById('team-end'),
  teamActive: document.getElementById('team-active'),
  teamSubmit: document.getElementById('team-submit'),
  teamReset: document.getElementById('team-reset'),
  teamFeedback: document.getElementById('team-feedback'),
  teamList: document.getElementById('team-list'),
};

init();

async function init() {
  setDefaultDates();
  setHourlyRateDisplay();
  bindEvents();
  await restoreSession();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

function setDefaultDates(preserveFilter = false) {
  const today = new Date().toISOString().slice(0, 10);
  elements.entryDate.value = today;
  if (!preserveFilter) {
    elements.filterMonth.value = state.filters.month;
  }
}

function setHourlyRateDisplay() {
  if (elements.hourlyRateDisplay) {
    elements.hourlyRateDisplay.value = formatCurrency(DEFAULT_HOURLY_RATE);
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
    el.addEventListener('input', updateComputedFields)
  );
  elements.entryTeam.addEventListener('change', applyTeamDefaults);
  elements.entryTrainer.addEventListener('change', updateComputedFields);

  elements.filterMonth.addEventListener('change', handleFilterChange);
  elements.filterTrainer.addEventListener('change', handleFilterChange);

  elements.trainerForm.addEventListener('submit', handleTrainerSubmit);
  elements.trainerReset.addEventListener('click', resetTrainerForm);

  elements.teamForm.addEventListener('submit', handleTeamSubmit);
  elements.teamReset.addEventListener('click', resetTeamForm);
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

  const payload = buildEntryPayload();
  if (!payload) return;

  elements.entryForm.classList.add('loading');
  const { error } = await supabase.from('performance_entries').insert({
    ...payload,
    created_by: state.session.user.id,
  });
  elements.entryForm.classList.remove('loading');

  if (error) {
    console.error('Supabase error', error);
    showFeedback(elements.entryFeedback, error.message, true);
    return;
  }

  showFeedback(elements.entryFeedback, 'Eintrag gespeichert.');
  elements.entryForm.reset();
  setDefaultDates(true);
  elements.entryTeam.value = '';
  updateComputedFields();
  await loadEntries();
}

function buildEntryPayload() {
  const date = elements.entryDate.value;
  const teamId = elements.entryTeam.value;
  const trainerId = elements.entryTrainer.value;
  const start = elements.startTime.value;
  const end = elements.endTime.value;

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
    team_id: teamId || null,
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

function calculateDuration(start, end) {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : 0;
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

async function loadTeams() {
  if (!state.session) return;
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Mannschaften nicht laden: ' + error.message, 'error');
    return;
  }

  state.teams = data || [];
  populateTeamSelect();
  renderTeamList();
}

function populateTeamSelect() {
  elements.entryTeam.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Keine Mannschaft';
  elements.entryTeam.appendChild(emptyOption);

  const activeTeams = state.teams.filter((team) => team.is_active !== false);
  activeTeams.forEach((team) => {
    const trainer = state.trainers.find((t) => t.id === team.trainer_id);
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = `${team.name}${trainer ? ` (Trainer: ${trainer.name})` : ''}`;
    elements.entryTeam.appendChild(option);
  });
}

function renderTeamList() {
  elements.teamList.innerHTML = '';
  if (!state.teams.length) {
    elements.teamList.innerHTML = '<p class="muted">Noch keine Mannschaften hinterlegt.</p>';
    return;
  }

  state.teams.forEach((team) => {
    const trainer = state.trainers.find((t) => t.id === team.trainer_id);
    const item = document.createElement('div');
    item.className = 'trainer-item';
    const schedule = team.default_day
      ? `${team.default_day} ${team.default_start_time?.slice(0, 5) || ''} - ${team.default_end_time?.slice(0, 5) || ''}`
      : 'Kein Standardtermin';

    item.innerHTML = `
      <div>
        <strong>${team.name}</strong>
        <p class="muted small">${trainer ? trainer.name : 'Ohne Trainer'}</p>
        <p class="muted small">${schedule}</p>
      </div>
      <div class="trainer-meta">
        <span class="pill ${team.is_active === false ? 'pill-danger' : 'pill-success'}">${
      team.is_active === false ? 'Inaktiv' : 'Aktiv'
    }</span>
        <button class="ghost" data-action="edit" data-id="${team.id}">Bearbeiten</button>
        <button class="secondary" data-action="toggle" data-id="${team.id}">${
      team.is_active === false ? 'Aktivieren' : 'Deaktivieren'
    }</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener('click', () => startEditTeam(team));
    item.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTeam(team));

    elements.teamList.appendChild(item);
  });
}

function startEditTeam(team) {
  state.editingTeamId = team.id;
  elements.teamId.value = team.id;
  elements.teamName.value = team.name || '';
  elements.teamTrainer.value = team.trainer_id || '';
  elements.teamDay.value = team.default_day || '';
  elements.teamStart.value = team.default_start_time?.slice(0, 5) || '';
  elements.teamEnd.value = team.default_end_time?.slice(0, 5) || '';
  elements.teamActive.checked = team.is_active !== false;
  elements.teamSubmit.textContent = 'Mannschaft aktualisieren';
  showFeedback(elements.teamFeedback, `Bearbeitung von ${team.name}`);
}

async function toggleTeam(team) {
  const { error } = await supabase
    .from('teams')
    .update({ is_active: team.is_active === false, updated_at: new Date().toISOString() })
    .eq('id', team.id);

  if (error) {
    console.error('Supabase error', error);
    setStatus('Konnte Status nicht ändern: ' + error.message, 'error');
    return;
  }

  setStatus(`Status für ${team.name} angepasst.`);
  await loadTeams();
  await loadEntries();
}

async function handleTeamSubmit(event) {
  event.preventDefault();
  if (!state.session) return;

  const payload = {
    name: elements.teamName.value.trim(),
    trainer_id: elements.teamTrainer.value || null,
    default_day: elements.teamDay.value.trim() || null,
    default_start_time: elements.teamStart.value || null,
    default_end_time: elements.teamEnd.value || null,
    is_active: elements.teamActive.checked,
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
  elements.teamId.value = '';
  elements.teamForm.reset();
  elements.teamActive.checked = true;
  elements.teamSubmit.textContent = 'Mannschaft speichern';
  showFeedback(elements.teamFeedback, '');
}

function applyTeamDefaults() {
  const selectedTeam = state.teams.find((team) => team.id === elements.entryTeam.value);
  if (selectedTeam) {
    if (selectedTeam.trainer_id) {
      elements.entryTrainer.value = selectedTeam.trainer_id;
    }
    if (selectedTeam.default_start_time) {
      elements.startTime.value = selectedTeam.default_start_time.slice(0, 5);
    }
    if (selectedTeam.default_end_time) {
      elements.endTime.value = selectedTeam.default_end_time.slice(0, 5);
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

function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function setStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.type = type;
}
