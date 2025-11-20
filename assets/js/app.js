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

function normalizeTrainers(list) {
  let changed = false;
  const normalized = list.map((trainer) => {
    if (Array.isArray(trainer.teamIds)) {
      return trainer;
    }
    changed = true;
    return { ...trainer, teamIds: [] };
  });
  if (changed) {
    saveTrainers(normalized);
  }
  return normalized;
}

function loadTrainers() {
  const trainers = loadFromStorage(STORAGE_KEYS.trainers);
  return normalizeTrainers(trainers);
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
    trainers.push({ id: uuid(), name: 'Demo-Trainer', teamIds: [] });
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

function getTrainerById(id) {
  return loadTrainers().find((trainer) => trainer.id === id);
}

function getTeamById(id) {
  return loadTeams().find((team) => team.id === id);
}

// Trainer → Mannschaft Mapping: liefert gefilterte Teams für einen Trainer
function getTeamsForTrainer(trainerId) {
  const teams = loadTeams();
  if (!trainerId || trainerId === 'all') return teams;
  const trainer = getTrainerById(trainerId);
  if (!trainer || !trainer.teamIds || trainer.teamIds.length === 0) return teams;
  return teams.filter((team) => trainer.teamIds.includes(team.id));
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
    const previousValue = select.value;
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

    if (previousValue && Array.from(select.options).some((opt) => opt.value === previousValue)) {
      select.value = previousValue;
    } else if (!includeAllOption && select.options.length > 0) {
      select.value = select.options[0].value;
    }
  });
}

function renderTeamOptions(selectElements, includeAllOption = false, trainerId = null) {
  const teams = trainerId ? getTeamsForTrainer(trainerId) : loadTeams();
  selectElements.forEach((select) => {
    const previousValue = select.value;
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

    if (previousValue && Array.from(select.options).some((opt) => opt.value === previousValue)) {
      select.value = previousValue;
    } else if (!includeAllOption && select.options.length > 0) {
      select.value = select.options[0].value;
    }
  });
}

function renderTrainerList() {
  const trainerList = document.getElementById('trainer-list');
  const trainers = loadTrainers();
  trainerList.innerHTML = '';
  trainers.forEach((trainer) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = trainer.name;
    li.appendChild(nameSpan);
    const editBtn = document.createElement('button');
    editBtn.className = 'ghost-btn';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openTrainerTeamsModal(trainer.id));
    li.appendChild(editBtn);
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
  renderTrainerOptions([document.getElementById('entry-trainer')], false);
  renderTrainerOptions([document.getElementById('filter-trainer')], true);
  updateEntryTeamOptions();
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
  updateEntryTeamOptions();
  renderTeamOptions([document.getElementById('filter-team')], true);
  renderOverview();
}

function resetEntryForm() {
  const form = document.getElementById('entry-form');
  form.reset();
  document.getElementById('entry-date').valueAsDate = new Date();
}

function validateEntryFields({ date, startTime, endTime, trainerId, teamId }, feedbackTarget) {
  if (!date || !startTime || !endTime || !trainerId || !teamId || trainerId === 'all' || teamId === 'all') {
    feedbackTarget.textContent = 'Bitte alle Pflichtfelder ausfüllen.';
    feedbackTarget.style.color = 'var(--danger)';
    return null;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    feedbackTarget.textContent = 'Endzeit muss nach der Startzeit liegen.';
    feedbackTarget.style.color = 'var(--danger)';
    return null;
  }

  feedbackTarget.textContent = '';
  return endMinutes - startMinutes;
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

  const durationMinutes = validateEntryFields({ date, startTime, endTime, trainerId, teamId }, feedback);
  if (durationMinutes === null) return;

  const newEntry = {
    id: uuid(),
    date,
    startTime,
    endTime,
    durationMinutes,
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

// Mannschaften nach Trainer filtern
function updateEntryTeamOptions() {
  const trainerId = document.getElementById('entry-trainer').value;
  renderTeamOptions([document.getElementById('entry-team')], false, trainerId);
}

function initForms() {
  const entryDate = document.getElementById('entry-date');
  entryDate.valueAsDate = new Date();
  document.getElementById('entry-form').addEventListener('submit', handleEntrySubmit);

  document.getElementById('entry-trainer').addEventListener('change', () => {
    updateEntryTeamOptions();
    document.getElementById('entry-team').value = document.getElementById('entry-team').options[0]?.value || '';
  });

  document.getElementById('trainer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('trainer-name');
    const name = input.value.trim();
    if (!name) return;
    const trainers = loadTrainers();
    trainers.push({ id: uuid(), name, teamIds: [] });
    saveTrainers(trainers);
    input.value = '';
    renderTrainerList();
    renderTrainerOptions([
      document.getElementById('entry-trainer')
    ], false);
    renderTrainerOptions([
      document.getElementById('filter-trainer')
    ], true);
    updateEntryTeamOptions();
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
    updateEntryTeamOptions();
    renderTeamOptions([
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
    cell.colSpan = 10;
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

        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.title = 'Eintrag bearbeiten';
        editBtn.textContent = '✎';
        editBtn.addEventListener('click', () => openEditEntryModal(entry.id));
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn';
        deleteBtn.title = 'Eintrag löschen';
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', () => handleDeleteEntry(entry.id));
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);
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

// Trainer bearbeiten: Mannschaftszuordnung via Modal
function openTrainerTeamsModal(trainerId) {
  const trainer = getTrainerById(trainerId);
  if (!trainer) return;
  const teams = loadTeams();

  const wrapper = document.createElement('div');
  const hint = document.createElement('p');
  hint.className = 'small-muted';
  hint.textContent = 'Keine Auswahl bedeutet: Trainer kann alle Mannschaften betreuen.';
  wrapper.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'checkbox-list';
  teams.forEach((team) => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = team.id;
    checkbox.checked = trainer.teamIds?.includes(team.id);
    const text = document.createElement('span');
    text.textContent = team.name;
    label.appendChild(checkbox);
    label.appendChild(text);
    list.appendChild(label);
  });
  wrapper.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'secondary';
  cancel.type = 'button';
  cancel.textContent = 'Abbrechen';
  cancel.addEventListener('click', closeModal);
  const save = document.createElement('button');
  save.className = 'primary';
  save.type = 'button';
  save.textContent = 'Speichern';
  save.addEventListener('click', () => {
    const selected = Array.from(list.querySelectorAll('input:checked')).map((input) => input.value);
    const trainers = loadTrainers().map((item) => (item.id === trainerId ? { ...item, teamIds: selected } : item));
    saveTrainers(trainers);
    renderTrainerList();
    renderTrainerOptions([document.getElementById('entry-trainer')], false);
    renderTrainerOptions([document.getElementById('filter-trainer')], true);
    updateEntryTeamOptions();
    renderOverview();
    closeModal();
  });
  actions.appendChild(cancel);
  actions.appendChild(save);
  wrapper.appendChild(actions);

  openModal(`Mannschaften für ${trainer.name}`, wrapper);
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

// Bearbeiten-/Löschen-Flow in der Übersicht
function handleDeleteEntry(entryId) {
  if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) return;
  const updated = loadEntries().filter((entry) => entry.id !== entryId);
  saveEntries(updated);
  renderOverview();
}

function openEditEntryModal(entryId) {
  const entry = loadEntries().find((item) => item.id === entryId);
  if (!entry) return;

  const form = document.createElement('form');
  form.className = 'form-grid';

  const dateLabel = document.createElement('label');
  dateLabel.innerHTML = '<span>Datum</span>';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.value = entry.date;
  dateLabel.appendChild(dateInput);
  form.appendChild(dateLabel);

  const timeRow = document.createElement('div');
  timeRow.className = 'time-row full-width';
  const startLabel = document.createElement('label');
  startLabel.innerHTML = '<span>Startzeit</span>';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.step = '300';
  startInput.required = true;
  startInput.value = entry.startTime;
  startLabel.appendChild(startInput);
  const endLabel = document.createElement('label');
  endLabel.innerHTML = '<span>Endzeit</span>';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.step = '300';
  endInput.required = true;
  endInput.value = entry.endTime;
  endLabel.appendChild(endInput);
  timeRow.appendChild(startLabel);
  timeRow.appendChild(endLabel);
  form.appendChild(timeRow);

  const trainerLabel = document.createElement('label');
  trainerLabel.innerHTML = '<span>Trainer</span>';
  const trainerSelect = document.createElement('select');
  trainerSelect.required = true;
  trainerLabel.appendChild(trainerSelect);
  form.appendChild(trainerLabel);

  const teamLabel = document.createElement('label');
  teamLabel.innerHTML = '<span>Mannschaft</span>';
  const teamSelect = document.createElement('select');
  teamSelect.required = true;
  teamLabel.appendChild(teamSelect);
  form.appendChild(teamLabel);

  const typeLabel = document.createElement('label');
  typeLabel.innerHTML = '<span>Art</span>';
  const typeSelect = document.createElement('select');
  typeSelect.required = true;
  ['Training', 'Spiel', 'Turnier', 'Sonstiges'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    typeSelect.appendChild(option);
  });
  typeLabel.appendChild(typeSelect);
  form.appendChild(typeLabel);

  const notesLabel = document.createElement('label');
  notesLabel.className = 'full-width';
  notesLabel.innerHTML = '<span>Notizen</span>';
  const notesTextarea = document.createElement('textarea');
  notesTextarea.rows = 3;
  notesTextarea.value = entry.notes || '';
  notesLabel.appendChild(notesTextarea);
  form.appendChild(notesLabel);

  renderTrainerOptions([trainerSelect], false);
  trainerSelect.value = entry.trainerId;
  renderTeamOptions([teamSelect], false, trainerSelect.value);
  teamSelect.value = entry.teamId;
  typeSelect.value = entry.type;

  trainerSelect.addEventListener('change', () => {
    renderTeamOptions([teamSelect], false, trainerSelect.value);
    teamSelect.value = teamSelect.options[0]?.value || '';
  });

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  form.appendChild(feedback);

  const actions = document.createElement('div');
  actions.className = 'modal-actions full-width';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Abbrechen';
  cancel.addEventListener('click', closeModal);
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'primary';
  save.textContent = 'Speichern';
  actions.appendChild(cancel);
  actions.appendChild(save);
  form.appendChild(actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const durationMinutes = validateEntryFields(
      {
        date: dateInput.value,
        startTime: startInput.value,
        endTime: endInput.value,
        trainerId: trainerSelect.value,
        teamId: teamSelect.value
      },
      feedback
    );
    if (durationMinutes === null) return;

    const updatedEntries = loadEntries().map((item) =>
      item.id === entryId
        ? {
            ...item,
            date: dateInput.value,
            startTime: startInput.value,
            endTime: endInput.value,
            trainerId: trainerSelect.value,
            teamId: teamSelect.value,
            type: typeSelect.value,
            notes: notesTextarea.value.trim(),
            durationMinutes
          }
        : item
    );
    saveEntries(updatedEntries);
    renderOverview();
    closeModal();
  });

  openModal('Eintrag bearbeiten', form);
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

function openModal(title, contentNode) {
  const modal = document.getElementById('modal-backdrop');
  document.getElementById('modal-title').textContent = title;
  const container = document.getElementById('modal-content');
  container.innerHTML = '';
  container.appendChild(contentNode);
  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('modal-backdrop');
  document.getElementById('modal-content').innerHTML = '';
  modal.classList.add('hidden');
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
    document.getElementById('entry-trainer')
  ], false);
  renderTrainerOptions([
    document.getElementById('filter-trainer')
  ], true);
  updateEntryTeamOptions();
  document.getElementById('entry-team').value = document.getElementById('entry-team').options[0]?.value || '';
  renderTeamOptions([
    document.getElementById('filter-team')
  ], true);

  renderTrainerList();
  renderTeamList();
  renderOverview();
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (event) => {
    if (event.target.id === 'modal-backdrop') closeModal();
  });
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', initApp);
