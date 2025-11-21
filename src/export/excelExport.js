import ExcelJS from 'https://esm.sh/exceljs@4';

export async function exportToExcel({ supabase, filters }) {
  const query = buildQuery(supabase, filters);
  const { data, error } = await query;

  if (error) {
    return { error };
  }

  const entries = data || [];
  if (!entries.length) {
    return { exportedFiles: 0, totalEntries: 0 };
  }

  const grouped = groupByTrainer(entries);
  let exportedFiles = 0;

  for (const [trainerName, trainerEntries] of Object.entries(grouped)) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(trainerName || 'Trainer');

    sheet.columns = [
      { header: 'Datum', key: 'date', width: 16 },
      { header: 'Start', key: 'start', width: 10 },
      { header: 'Ende', key: 'end', width: 10 },
      { header: 'Dauer (Minuten)', key: 'duration', width: 16 },
      { header: 'Trainer', key: 'trainer', width: 24 },
      { header: 'Mannschaft', key: 'team', width: 24 },
      { header: 'Aktivität', key: 'activity', width: 18 },
      { header: 'Kosten', key: 'cost', width: 12 },
      { header: 'Notizen', key: 'notes', width: 32 },
    ];

    trainerEntries.forEach((entry) => {
      sheet.addRow({
        date: formatDate(entry.date),
        start: entry.start_time?.slice(0, 5) || '',
        end: entry.end_time?.slice(0, 5) || '',
        duration: entry.duration_minutes ?? '',
        trainer: entry.trainers?.name || 'Unbekannter Trainer',
        team: entry.teams?.name || '–',
        activity: entry.activity || '',
        cost: formatCurrency(entry.cost),
        notes: entry.notes || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBuffer(buffer, trainerName || 'trainer', filters?.month);
    exportedFiles += 1;
  }

  return { exportedFiles, totalEntries: entries.length };
}

function buildQuery(supabase, filters) {
  let query = supabase
    .from('performance_entries')
    .select(
      `id, date, start_time, end_time, duration_minutes, activity, notes, cost, trainer_id, team_id,
       trainers(name), teams(name)`
    )
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });

  if (filters?.month) {
    const { start, end } = monthRange(filters.month);
    query = query.gte('date', start).lte('date', end);
  }

  if (filters?.trainerId) {
    query = query.eq('trainer_id', filters.trainerId);
  }

  if (filters?.teamId) {
    query = query.eq('team_id', filters.teamId);
  }

  return query;
}

function groupByTrainer(entries) {
  return entries.reduce((acc, entry) => {
    const name = entry.trainers?.name || 'Unbekannter Trainer';
    if (!acc[name]) acc[name] = [];
    acc[name].push(entry);
    return acc;
  }, {});
}

function monthRange(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = `${monthValue}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function downloadBuffer(buffer, trainerName, month) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName(trainerName, month);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildFileName(trainerName, month) {
  const slug = (trainerName || 'trainer')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
  const monthPart = month ? `_${month}` : '';
  return `leistungsnachweis_${slug}${monthPart}.xlsx`;
}
