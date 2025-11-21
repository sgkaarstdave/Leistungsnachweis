const STORAGE_KEYS = {
  trainers: 'ln_trainers',
  teams: 'ln_teams',
  entries: 'ln_entries'
};

// Einheitlicher Stundensatz für den Excel-Export
const HOURLY_RATE = 12.5;

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
    // teamIds wird beim Laden immer auf ein Array gesetzt, damit die Filterlogik stabil bleibt
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
  return normalizeTeams(loadFromStorage(STORAGE_KEYS.teams));
}

function saveTeams(list) {
  saveToStorage(STORAGE_KEYS.teams, list);
}

function normalizeTeams(list) {
  let changed = false;
  const normalized = list.map((team) => {
    // Standardzeiten sicherstellen, damit ältere Datensätze migriert werden
    const withDefaults = {
      ...team,
      defaultStartTime: Object.prototype.hasOwnProperty.call(team, 'defaultStartTime')
        ? team.defaultStartTime
        : null,
      defaultEndTime: Object.prototype.hasOwnProperty.call(team, 'defaultEndTime')
        ? team.defaultEndTime
        : null
    };

    if (withDefaults.defaultStartTime !== team.defaultStartTime || withDefaults.defaultEndTime !== team.defaultEndTime) {
      changed = true;
    }
    return withDefaults;
  });

  if (changed) {
    saveTeams(normalized);
  }

  return normalized;
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
    teams.push({ id: uuid(), name: 'Demo-Team', defaultStartTime: null, defaultEndTime: null });
    saveTeams(teams);
  }
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

function minutesToTimeString(totalMinutes) {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Automatische Endzeit (+2 Stunden) setzen, wenn Startzeit gewählt wird
function attachAutoEndTime(startInput, endInput) {
  const updateEndTime = () => {
    if (!startInput.value) return;
    const startMinutes = parseTimeToMinutes(startInput.value);
    const proposed = startMinutes + 120;
    endInput.value = minutesToTimeString(proposed);
  };

  ['change', 'blur'].forEach((eventName) => {
    startInput.addEventListener(eventName, updateEndTime);
  });
}

function attachTimeSuggestions(inputs, intervalMinutes = 15) {
  const datalist = document.getElementById('time-options');
  if (datalist && datalist.children.length === 0) {
    for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
      const option = document.createElement('option');
      option.value = minutesToTimeString(minutes);
      datalist.appendChild(option);
    }
  }

  inputs.forEach((input) => {
    input.setAttribute('list', 'time-options');
  });
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

function renderTeamOptions(
  selectElements,
  includeAllOption = false,
  trainerId = null,
  { preferredValue, placeholderTextWhenMissing } = {}
) {
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

    const desiredValue = preferredValue ?? previousValue;
    const hasDesiredValue = desiredValue && Array.from(select.options).some((opt) => opt.value === desiredValue);

    if (hasDesiredValue) {
      select.value = desiredValue;
    } else if (placeholderTextWhenMissing) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = placeholderTextWhenMissing;
      select.insertBefore(placeholder, select.firstChild);
      select.value = '';
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
    editBtn.textContent = 'Zuordnen';
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

    const title = document.createElement('div');
    title.className = 'team-row';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = team.name;
    title.appendChild(nameSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Mannschaft löschen';
    deleteBtn.addEventListener('click', () => deleteTeam(team.id));
    title.appendChild(deleteBtn);
    li.appendChild(title);

    const timeContainer = document.createElement('div');
    timeContainer.className = 'team-times';

    const startLabel = document.createElement('label');
    startLabel.innerHTML = '<span>Standard Start</span>';
    startLabel.classList.add('team-time-label');
    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.className = 'team-time-input';
    startInput.value = team.defaultStartTime || '';
    startInput.addEventListener('change', () => updateTeamDefaultTime(team.id, 'defaultStartTime', startInput.value));
    startLabel.appendChild(startInput);

    const endLabel = document.createElement('label');
    endLabel.innerHTML = '<span>Standard Ende</span>';
    endLabel.classList.add('team-time-label');
    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.className = 'team-time-input';
    endInput.value = team.defaultEndTime || '';
    endInput.addEventListener('change', () => updateTeamDefaultTime(team.id, 'defaultEndTime', endInput.value));
    endLabel.appendChild(endInput);

    timeContainer.appendChild(startLabel);
    timeContainer.appendChild(endLabel);
    li.appendChild(timeContainer);

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

function updateTeamDefaultTime(teamId, field, value) {
  const teams = loadTeams();
  const updated = teams.map((team) =>
    team.id === teamId
      ? { ...team, [field]: value || null }
      : team
  );
  // Standardzeiten werden im Team gespeichert
  saveTeams(updated);
  renderTeamList();
  updateEntryTeamOptions();
}

function resetEntryForm() {
  const form = document.getElementById('entry-form');
  form.reset();
  document.getElementById('entry-date').valueAsDate = new Date();
  document.getElementById('startTime').value = '';
  document.getElementById('endTime').value = '';
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
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
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
function updateEntryTeamOptions(options = {}) {
  const { startInput, endInput } = options;
  const trainerId = document.getElementById('entry-trainer').value;
  const teamSelect = document.getElementById('entry-team');
  renderTeamOptions(
    [teamSelect],
    false,
    trainerId,
    {
      preferredValue: teamSelect.value,
      // Wenn die aktuelle Auswahl nach der Traineränderung nicht mehr erlaubt ist, neutralisieren
      placeholderTextWhenMissing: 'Bitte Mannschaft wählen'
    }
  );

  if (startInput && endInput) {
    applySelectedTeamDefaults(teamSelect.value, startInput, endInput);
  }
}

function applySelectedTeamDefaults(teamId, startInput, endInput) {
  const team = getTeamById(teamId);
  if (team && team.defaultStartTime && team.defaultEndTime) {
    // Standardzeiten beim Mannschaftswechsel vorbefüllen
    startInput.value = team.defaultStartTime;
    endInput.value = team.defaultEndTime;
  }
}

function initForms() {
  const entryDate = document.getElementById('entry-date');
  entryDate.valueAsDate = new Date();
  document.getElementById('entry-form').addEventListener('submit', handleEntrySubmit);
  const startInput = document.getElementById('startTime');
  const endInput = document.getElementById('endTime');
  const teamSelect = document.getElementById('entry-team');
  attachAutoEndTime(startInput, endInput);
  attachTimeSuggestions([startInput, endInput]);

  document.getElementById('entry-trainer').addEventListener('change', () => {
    updateEntryTeamOptions({ startInput, endInput });
  });

  teamSelect.addEventListener('change', () => applySelectedTeamDefaults(teamSelect.value, startInput, endInput));

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
    teams.push({ id: uuid(), name, defaultStartTime: null, defaultEndTime: null });
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

  const filterTrainer = document.getElementById('filter-trainer');
  const filterTeam = document.getElementById('filter-team');

  const updateFilterTeams = () => {
    // Mannschaften im Filter nach gewähltem Trainer einschränken
    renderTeamOptions([filterTeam], true, filterTrainer.value, {
      preferredValue: filterTeam.value
    });
  };

  monthInput.addEventListener('change', renderOverview);
  filterTrainer.addEventListener('change', () => {
    updateFilterTeams();
    renderOverview();
  });
  filterTeam.addEventListener('change', renderOverview);

  updateFilterTeams();
  document.getElementById('export-btn').addEventListener('click', exportToExcel);
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
  startInput.step = '1800';
  startInput.required = true;
  startInput.className = 'time-input';
  startInput.value = entry.startTime;
  startLabel.appendChild(startInput);
  const endLabel = document.createElement('label');
  endLabel.innerHTML = '<span>Endzeit</span>';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.step = '1800';
  endInput.required = true;
  endInput.className = 'time-input';
  endInput.value = entry.endTime;
  endLabel.appendChild(endInput);
  timeRow.appendChild(startLabel);
  timeRow.appendChild(endLabel);
  form.appendChild(timeRow);
  attachAutoEndTime(startInput, endInput);
  attachTimeSuggestions([startInput, endInput]);

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
  renderTeamOptions(
    [teamSelect],
    false,
    trainerSelect.value,
    {
      preferredValue: entry.teamId,
      placeholderTextWhenMissing: 'Bitte Mannschaft wählen'
    }
  );
  typeSelect.value = entry.type;

  teamSelect.addEventListener('change', () => applySelectedTeamDefaults(teamSelect.value, startInput, endInput));

  trainerSelect.addEventListener('change', () => {
    renderTeamOptions(
      [teamSelect],
      false,
      trainerSelect.value,
      {
        preferredValue: teamSelect.value,
        placeholderTextWhenMissing: 'Bitte Mannschaft wählen'
      }
    );

    applySelectedTeamDefaults(teamSelect.value, startInput, endInput);
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

function sanitizeFilenamePart(value) {
  const replacements = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    Ä: 'Ae',
    Ö: 'Oe',
    Ü: 'Ue',
    ß: 'ss'
  };

  return value
    .split('')
    .map((char) => replacements[char] || char)
    .join('')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '');
}

function getMonthName(month) {
  const months = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember'
  ];
  return months[month - 1] || String(month);
}

function addStylesToSheet(sheet, ranges) {
  ranges.forEach(({ cell, style }) => {
    if (!sheet[cell]) return;
    sheet[cell].s = { ...(sheet[cell].s || {}), ...style };
  });
}

function exportSingleTrainerWorkbook(trainer, entries, month, year, teams) {
  const monthPart = String(month).padStart(2, '0');
  const totalMinutes = entries.reduce((acc, entry) => acc + entry.durationMinutes, 0);
  const totalHoursDecimal = Number((totalMinutes / 60).toFixed(2));
  const amount = Number((totalHoursDecimal * HOURLY_RATE).toFixed(2));
  const monthName = getMonthName(month);

  const overviewHeader = [
    'TrainerName',
    'GesamtMinuten',
    'GesamtStundenDezimal',
    'GesamtStundenHHMM',
    'Monat',
    'Jahr',
    'AnzahlEinsaetze',
    'StundensatzEuro',
    'BetragEuro'
  ];

  const overviewRow = [
    trainer.name,
    totalMinutes,
    totalHoursDecimal,
    formatDuration(totalMinutes),
    monthPart,
    year,
    entries.length,
    HOURLY_RATE,
    amount
  ];

  const detailsHeader = [
    'Datum',
    'Startzeit',
    'Endzeit',
    'DauerMinuten',
    'DauerHHMM',
    'Mannschaft',
    'Typ',
    'Notizen'
  ];

  const sortedEntries = entries
    .slice()
    .sort(
      (a, b) => new Date(a.date) - new Date(b.date) || parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    )
    .map((entry) => {
      const teamName = teams.find((t) => t.id === entry.teamId)?.name || 'Unbekannt';
      return [
        entry.date,
        entry.startTime,
        entry.endTime,
        entry.durationMinutes,
        formatDuration(entry.durationMinutes),
        teamName,
        entry.type,
        entry.notes || ''
      ];
    });

  const today = new Date().toLocaleDateString('de-DE');

  const worksheetData = [
    [`Leistungsnachweis Volleyball – ${trainer.name} – ${monthName} ${year}`],
    [],
    ['Übersicht'],
    overviewHeader,
    overviewRow,
    [],
    ['Details'],
    detailsHeader,
    ...sortedEntries,
    [],
    ['Datum:', today],
    ['__________________________', '', '__________________________'],
    ['Unterschrift Abteilungsleitung', '', 'Unterschrift Trainer / Übungsleiter']
  ];

  const sheet = XLSX.utils.aoa_to_sheet(worksheetData);

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(detailsHeader.length, overviewHeader.length) - 1 } }
  ];

  sheet['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 }
  ];

  const currencyFormat = '#,##0.00 "€"';
  const overviewRowIndex = 4;
  const rateCell = XLSX.utils.encode_cell({ r: overviewRowIndex, c: 7 });
  const amountCell = XLSX.utils.encode_cell({ r: overviewRowIndex, c: 8 });

  sheet[rateCell] = { v: HOURLY_RATE, t: 'n', z: currencyFormat };
  sheet[amountCell] = { v: amount, t: 'n', z: currencyFormat };

  const boldHeaderStyle = { font: { bold: true, sz: 12 } };
  const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
  const labelStyle = { font: { bold: true, sz: 12 } };
  const numberAlignment = { alignment: { horizontal: 'right' } };

  addStylesToSheet(sheet, [
    { cell: XLSX.utils.encode_cell({ r: 0, c: 0 }), style: titleStyle },
    { cell: XLSX.utils.encode_cell({ r: 2, c: 0 }), style: labelStyle },
    { cell: XLSX.utils.encode_cell({ r: 6, c: 0 }), style: labelStyle }
  ]);

  overviewHeader.forEach((_, index) => {
    const headerCell = XLSX.utils.encode_cell({ r: 3, c: index });
    addStylesToSheet(sheet, [{ cell: headerCell, style: boldHeaderStyle }]);
    const dataCell = XLSX.utils.encode_cell({ r: overviewRowIndex, c: index });
    if (index > 0) {
      addStylesToSheet(sheet, [{ cell: dataCell, style: numberAlignment }]);
    }
  });

  detailsHeader.forEach((_, index) => {
    const headerCell = XLSX.utils.encode_cell({ r: 7, c: index });
    addStylesToSheet(sheet, [{ cell: headerCell, style: boldHeaderStyle }]);
  });

  const detailsStartRow = 8;
  sortedEntries.forEach((_, idx) => {
    const rowIndex = detailsStartRow + idx;
    const minuteCell = XLSX.utils.encode_cell({ r: rowIndex, c: 3 });
    const durationCell = XLSX.utils.encode_cell({ r: rowIndex, c: 4 });
    addStylesToSheet(sheet, [
      { cell: minuteCell, style: numberAlignment },
      { cell: durationCell, style: { alignment: { horizontal: 'center' } } }
    ]);
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Nachweis');

  const safeTrainerName = sanitizeFilenamePart(trainer.name || 'Unbekannt');
  XLSX.writeFile(workbook, `leistungsnachweis_${safeTrainerName}_${year}-${monthPart}.xlsx`);
}

function exportTrainerHtml(trainer, entries, month, year, teams) {
  const monthPart = String(month).padStart(2, '0');
  const monthName = getMonthName(month);
  const totalMinutes = entries.reduce((acc, entry) => acc + entry.durationMinutes, 0);
  const totalHoursDecimal = Number((totalMinutes / 60).toFixed(2));
  const amount = Number((totalHoursDecimal * HOURLY_RATE).toFixed(2));
  const today = new Date().toLocaleDateString('de-DE');

  const overviewHeader = [
    'TrainerName',
    'GesamtMinuten',
    'GesamtStundenDezimal',
    'GesamtStundenHHMM',
    'Monat',
    'Jahr',
    'AnzahlEinsaetze',
    'StundensatzEuro',
    'BetragEuro'
  ];

  const overviewRow = [
    trainer.name,
    totalMinutes,
    totalHoursDecimal,
    formatDuration(totalMinutes),
    monthPart,
    year,
    entries.length,
    `${HOURLY_RATE.toFixed(2)} €`,
    `${amount.toFixed(2)} €`
  ];

  const detailsHeader = [
    'Datum',
    'Startzeit',
    'Endzeit',
    'DauerMinuten',
    'DauerHHMM',
    'Mannschaft',
    'Typ',
    'Notizen'
  ];

  const sortedEntries = entries
    .slice()
    .sort(
      (a, b) => new Date(a.date) - new Date(b.date) || parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    )
    .map((entry) => {
      const teamName = teams.find((t) => t.id === entry.teamId)?.name || 'Unbekannt';
      return [
        entry.date,
        entry.startTime,
        entry.endTime,
        entry.durationMinutes,
        formatDuration(entry.durationMinutes),
        teamName,
        entry.type,
        entry.notes || ''
      ];
    });

  const escapeCell = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const overviewTable = [overviewHeader, overviewRow]
    .map((row, idx) =>
      `<tr>${row
        .map((cell) => `<${idx === 0 ? 'th' : 'td'}>${escapeCell(cell)}</${idx === 0 ? 'th' : 'td'}>`)
        .join('')}</tr>`
    )
    .join('');

  const detailsTable = [
    `<tr>${detailsHeader.map((cell) => `<th>${escapeCell(cell)}</th>`).join('')}</tr>`,
    ...sortedEntries.map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`)
  ].join('');

  const signatureBlockHtml = `<br><table><tr><td>Datum:</td><td>${escapeCell(today)}</td></tr><tr><td>__________________________</td><td></td><td>__________________________</td></tr><tr><td>Unterschrift Abteilungsleitung</td><td></td><td>Unterschrift Trainer / Übungsleiter</td></tr></table>`;

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;margin-top:8px;}td,th{border:1px solid #ccc;padding:4px;}h2{text-align:center;}th{background:#f2f2f2;}body{font-family:Arial, sans-serif;}</style></head><body><h2>Leistungsnachweis Volleyball – ${escapeCell(
    trainer.name
  )} – ${escapeCell(monthName)} ${escapeCell(String(year))}</h2><h3>Übersicht</h3><table>${overviewTable}</table><h3>Details</h3><table>${detailsTable}</table>${signatureBlockHtml}</body></html>`;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `leistungsnachweis_${sanitizeFilenamePart(trainer.name || 'Unbekannt')}_${year}-${monthPart}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Excel-Export: Trainer-Summen pro Monat erzeugen
function exportToExcel() {
  const monthInput = document.getElementById('overview-month');
  const trainerFilter = document.getElementById('filter-trainer');
  const teamFilter = document.getElementById('filter-team');
  const [yearValue, monthValue] = monthInput.value
    ? monthInput.value.split('-')
    : [String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, '0')];
  const year = Number(yearValue);
  const month = Number(monthValue);

  const entries = loadEntries();
  const trainers = loadTrainers();
  const teams = loadTeams();

  const filtered = entries.filter((entry) => {
    const entryDate = new Date(entry.date);
    const matchesMonth = entryDate.getFullYear() === year && entryDate.getMonth() + 1 === month;
    const matchesTrainer = trainerFilter.value === 'all' || entry.trainerId === trainerFilter.value;
    const matchesTeam = teamFilter.value === 'all' || entry.teamId === teamFilter.value;
    return matchesMonth && matchesTrainer && matchesTeam;
  });

  if (filtered.length === 0) {
    alert('Keine Einträge zum Exportieren.');
    return;
  }

  const groupedByTrainer = filtered.reduce((acc, entry) => {
    (acc[entry.trainerId] = acc[entry.trainerId] || []).push(entry);
    return acc;
  }, {});

  const trainerGroups = Object.keys(groupedByTrainer)
    .map((trainerId) => ({
      trainer: trainers.find((t) => t.id === trainerId) || { id: trainerId, name: 'Unbekannt' },
      entries: groupedByTrainer[trainerId]
    }))
    .sort((a, b) => a.trainer.name.localeCompare(b.trainer.name));

  if (typeof XLSX !== 'undefined') {
    trainerGroups.forEach(({ trainer, entries: trainerEntries }) => {
      exportSingleTrainerWorkbook(trainer, trainerEntries, month, year, teams);
    });
    return;
  }

  trainerGroups.forEach(({ trainer, entries: trainerEntries }) => {
    exportTrainerHtml(trainer, trainerEntries, month, year, teams);
  });
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
  updateEntryTeamOptions({
    startInput: document.getElementById('startTime'),
    endInput: document.getElementById('endTime')
  });
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
