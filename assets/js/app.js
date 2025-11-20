const STORAGE_KEYS = {
  trainers: 'ln_trainers',
  teams: 'ln_teams',
  entries: 'ln_entries'
};

function loadFromStorage(key, fallback = []) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Konnte Daten nicht laden, nutze Fallback', error);
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadTrainers() {
  return loadFromStorage(STORAGE_KEYS.trainers);
}

function saveTrainers(list) {
  saveToStorage(STORAGE_KEYS.trainers, list);
}

function loadTeams() {
  return loadFromStorage(STORAGE_KEYS.teams);
}

function saveTeams(list) {
  saveToStorage(STORAGE_KEYS.teams, list);
}

function loadEntries() {
  return loadFromStorage(STORAGE_KEYS.entries);
}

function saveEntries(list) {
  saveToStorage(STORAGE_KEYS.entries, list);
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2);
}

function ensureSeedData() {
  const trainers = loadTrainers();
  const teams = loadTeams();

  if (trainers.length === 0) {
    trainers.push({ id: uuid(), name: 'Demo-Trainer' });
    saveTrainers(trainers);
  }

  if (teams.length === 0) {
    teams.push({ id: uuid(), name: 'Demo-Team' });
    saveTeams(teams);
  }
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function setupNav() {
  const buttons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.section');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      sections.forEach((s) => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });
}

function renderTrainerOptions(selectElements, includeAllOption = false) {
  const trainers = loadTrainers();
  selectElements.forEach((select) => {
    select.innerHTML = '';
    if (includeAllOption) {
      const option = document.createElement('option');
      option.value = 'all';
      option.textContent = 'Alle Trainer';
      select.appendChild(option);
    }
    trainers.forEach((trainer) => {
      const option = document.createElement('option');
      option.value = trainer.id;
      option.textContent = trainer.name;
      select.appendChild(option);
    });
  });
}

function renderTeamOptions(selectElements, includeAllOption = false) {
  const teams = loadTeams();
  selectElements.forEach((select) => {
    select.innerHTML = '';
    if (includeAllOption) {
      const option = document.createElement('option');
      option.value = 'all';
      option.textContent = 'Alle Mannschaften';
      select.appendChild(option);
    }
    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      select.appendChild(option);
    });
  });
}

function renderTrainerList() {
  const trainerList = document.getElementById('trainer-list');
  const trainers = loadTrainers();
  trainerList.innerHTML = '';
  trainers.forEach((trainer) => {
    const li = document.createElement('li');
    li.textContent = trainer.name;
    const button = document.createElement('button');
    button.className = 'icon-btn';
    button.textContent = '✕';
    button.title = 'Trainer löschen';
    button.addEventListener('click', () => deleteTrainer(trainer.id));
    li.appendChild(button);
    trainerList.appendChild(li);
  });
}

function renderTeamList() {
  const teamList = document.getElementById('team-list');
  const teams = loadTeams();
  teamList.innerHTML = '';
  teams.forEach((team) => {
    const li = document.createElement('li');
    li.textContent = team.name;
    const button = document.createElement('button');
    button.className = 'icon-btn';
    button.textContent = '✕';
    button.title = 'Mannschaft löschen';
    button.addEventListener('click', () => deleteTeam(team.id));
    li.appendChild(button);
    teamList.appendChild(li);
  });
}

function deleteTrainer(trainerId) {
  const entries = loadEntries();
  const hasUsage = entries.some((entry) => entry.trainerId === trainerId);
  if (hasUsage && !confirm('Es existieren Einträge mit diesem Trainer. Trotzdem löschen?')) {
    return;
  }
  const updated = loadTrainers().filter((t) => t.id !== trainerId);
  saveTrainers(updated);
  renderTrainerList();
  renderTrainerOptions([document.getElementById('entry-trainer'), document.getElementById('filter-trainer')], true);
  renderOverview();
}

function deleteTeam(teamId) {
  const entries = loadEntries();
  const hasUsage = entries.some((entry) => entry.teamId === teamId);
  if (hasUsage && !confirm('Es existieren Einträge mit dieser Mannschaft. Trotzdem löschen?')) {
    return;
  }
  const updated = loadTeams().filter((t) => t.id !== teamId);
  saveTeams(updated);
  renderTeamList();
  renderTeamOptions([document.getElementById('entry-team'), document.getElementById('filter-team')], true);
  renderOverview();
}

function resetEntryForm() {
  const form = document.getElementById('entry-form');
  form.reset();
  document.getElementById('entry-date').valueAsDate = new Date();
}

function handleEntrySubmit(event) {
  event.preventDefault();
  const date = document.getElementById('entry-date').value;
  const startTime = document.getElementById('entry-start').value;
  const endTime = document.getElementById('entry-end').value;
  const trainerId = document.getElementById('entry-trainer').value;
  const teamId = document.getElementById('entry-team').value;
  const type = document.getElementById('entry-type').value;
  const notes = document.getElementById('entry-notes').value.trim();
  const feedback = document.getElementById('save-feedback');

  if (!date || !startTime || !endTime || !trainerId || !teamId) {
    feedback.textContent = 'Bitte alle Pflichtfelder ausfüllen.';
    feedback.style.color = 'var(--danger)';
    return;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    feedback.textContent = 'Endzeit muss nach der Startzeit liegen.';
    feedback.style.color = 'var(--danger)';
    return;
  }

  const newEntry = {
    id: uuid(),
    date,
    startTime,
    endTime,
    durationMinutes: endMinutes - startMinutes,
    trainerId,
    teamId,
    type,
    notes
  };

  const entries = loadEntries();
  entries.push(newEntry);
  saveEntries(entries);

  feedback.textContent = 'Eintrag gespeichert!';
  feedback.style.color = 'var(--success)';
  resetEntryForm();
  renderOverview();
}

function initForms() {
  const entryDate = document.getElementById('entry-date');
  entryDate.valueAsDate = new Date();
  document.getElementById('entry-form').addEventListener('submit', handleEntrySubmit);

  document.getElementById('trainer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('trainer-name');
    const name = input.value.trim();
    if (!name) return;
    const trainers = loadTrainers();
    trainers.push({ id: uuid(), name });
    saveTrainers(trainers);
    input.value = '';
    renderTrainerList();
    renderTrainerOptions([
      document.getElementById('entry-trainer'),
      document.getElementById('filter-trainer')
    ], true);
  });

  document.getElementById('team-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('team-name');
    const name = input.value.trim();
    if (!name) return;
    const teams = loadTeams();
    teams.push({ id: uuid(), name });
    saveTeams(teams);
    input.value = '';
    renderTeamList();
    renderTeamOptions([
      document.getElementById('entry-team'),
      document.getElementById('filter-team')
    ], true);
  });
}

function renderOverview() {
  const monthInput = document.getElementById('overview-month');
  const trainerFilter = document.getElementById('filter-trainer');
  const teamFilter = document.getElementById('filter-team');
  const entries = loadEntries();
  const trainers = loadTrainers();
  const teams = loadTeams();

  const [selectedYear, selectedMonth] = monthInput.value
    ? monthInput.value.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];

  const filtered = entries.filter((entry) => {
    const entryDate = new Date(entry.date);
    const matchesMonth =
      entryDate.getFullYear() === selectedYear && entryDate.getMonth() + 1 === selectedMonth;
    const matchesTrainer = trainerFilter.value === 'all' || entry.trainerId === trainerFilter.value;
    const matchesTeam = teamFilter.value === 'all' || entry.teamId === teamFilter.value;
    return matchesMonth && matchesTrainer && matchesTeam;
  });

  const tbody = document.getElementById('entries-body');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.textContent = 'Keine Einträge für diesen Zeitraum.';
    cell.className = 'empty';
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date) || parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime))
      .forEach((entry) => {
        const row = document.createElement('tr');
        const weekday = new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short' });
        const trainerName = trainers.find((t) => t.id === entry.trainerId)?.name || 'Unbekannt';
        const teamName = teams.find((t) => t.id === entry.teamId)?.name || 'Unbekannt';
        const cells = [
          entry.date,
          weekday,
          entry.startTime,
          entry.endTime,
          formatDuration(entry.durationMinutes),
          trainerName,
          teamName,
          entry.type,
          entry.notes || '–'
        ];
        cells.forEach((text) => {
          const cell = document.createElement('td');
          cell.textContent = text;
          row.appendChild(cell);
        });
        tbody.appendChild(row);
      });
  }

  const totalMinutes = filtered.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  document.getElementById('total-duration').textContent = formatDuration(totalMinutes);

  const breakdown = document.getElementById('trainer-breakdown');
  breakdown.innerHTML = '';
  const perTrainer = filtered.reduce((acc, entry) => {
    acc[entry.trainerId] = (acc[entry.trainerId] || 0) + entry.durationMinutes;
    return acc;
  }, {});

  Object.entries(perTrainer).forEach(([trainerId, minutes]) => {
    const name = trainers.find((t) => t.id === trainerId)?.name || 'Unbekannt';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${name}: ${formatDuration(minutes)}`;
    breakdown.appendChild(badge);
  });
}

function initFilters() {
  const monthInput = document.getElementById('overview-month');
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  monthInput.addEventListener('change', renderOverview);
  document.getElementById('filter-trainer').addEventListener('change', renderOverview);
  document.getElementById('filter-team').addEventListener('change', renderOverview);
  document.getElementById('export-btn').addEventListener('click', exportCsv);
}

function exportCsv() {
  const entriesTable = document.getElementById('entries-body');
  if (!entriesTable.children.length || entriesTable.querySelector('.empty')) {
    alert('Keine Einträge zum Exportieren.');
    return;
  }

  const monthInput = document.getElementById('overview-month');
  const [year, month] = monthInput.value.split('-');
  const trainerFilter = document.getElementById('filter-trainer');
  const teamFilter = document.getElementById('filter-team');

  const entries = loadEntries();
  const trainers = loadTrainers();
  const teams = loadTeams();

  const filtered = entries.filter((entry) => {
    const entryDate = new Date(entry.date);
    const matchesMonth = entryDate.getFullYear() === Number(year) && entryDate.getMonth() + 1 === Number(month);
    const matchesTrainer = trainerFilter.value === 'all' || entry.trainerId === trainerFilter.value;
    const matchesTeam = teamFilter.value === 'all' || entry.teamId === teamFilter.value;
    return matchesMonth && matchesTrainer && matchesTeam;
  });

  const header = ['Datum', 'Startzeit', 'Endzeit', 'Dauer', 'Trainer', 'Mannschaft', 'Typ', 'Notizen'];
  const rows = filtered.map((entry) => {
    const trainerName = trainers.find((t) => t.id === entry.trainerId)?.name || '';
    const teamName = teams.find((t) => t.id === entry.teamId)?.name || '';
    const escapedNotes = (entry.notes || '').replace(/"/g, '""');
    return [
      entry.date,
      entry.startTime,
      entry.endTime,
      formatDuration(entry.durationMinutes),
      trainerName,
      teamName,
      entry.type,
      `"${escapedNotes}"`
    ].join(',');
  });

  const csvContent = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const monthPart = String(month).padStart(2, '0');
  link.download = `leistungsnachweis_${year}-${monthPart}.csv`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service Worker Registrierung fehlgeschlagen', err);
    });
  }
}

function initApp() {
  ensureSeedData();
  setupNav();
  initForms();
  initFilters();

  renderTrainerOptions([
    document.getElementById('entry-trainer'),
    document.getElementById('filter-trainer')
  ], true);

  renderTeamOptions([
    document.getElementById('entry-team'),
    document.getElementById('filter-team')
  ], true);

  renderTrainerList();
  renderTeamList();
  renderOverview();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', initApp);
