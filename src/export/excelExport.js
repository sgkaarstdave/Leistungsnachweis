import ExcelJS from 'https://esm.sh/exceljs@4';
import JSZip from 'https://esm.sh/jszip@3.10.1';

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
  const trainerNames = Object.keys(grouped);
  const multipleTrainers = trainerNames.length > 1;
  let exportedFiles = 0;
  const files = [];

  for (const trainerName of trainerNames) {
    const trainerEntries = grouped[trainerName];
    const buffer = await buildWorkbookBuffer(trainerName, trainerEntries, filters?.month);
    exportedFiles += 1;

    if (multipleTrainers) {
      files.push({ trainerName, buffer });
    } else {
      downloadExcelBuffer(buffer, trainerName || 'trainer', filters?.month);
    }
  }

  if (multipleTrainers) {
    await downloadZip(files, filters?.month);
  }

  return { exportedFiles, totalEntries: entries.length };
}

async function buildWorkbookBuffer(trainerName, trainerEntries, month) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(trainerName || 'Trainer');

  sheet.columns = [
    { key: 'date', width: 16 },
    { key: 'start', width: 10 },
    { key: 'end', width: 10 },
    { key: 'duration', width: 16 },
    { key: 'trainer', width: 24 },
    { key: 'team', width: 24 },
    { key: 'activity', width: 18 },
    { key: 'cost', width: 12 },
    { key: 'notes', width: 32 },
  ];

  addTitleRow(sheet, trainerEntries, month, trainerName);
  const headerRow = sheet.addRow([
    'Datum',
    'Start',
    'Ende',
    'Dauer (Minuten)',
    'Trainer',
    'Mannschaft',
    'Aktivität',
    'Kosten',
    'Notizen',
  ]);
  styleHeaderRow(sheet, headerRow);

  trainerEntries.forEach((entry) => {
    sheet.addRow({
      date: toDate(entry.date),
      start: toExcelTime(entry.start_time),
      end: toExcelTime(entry.end_time),
      duration: toNumber(entry.duration_minutes),
      trainer: entry.trainers?.name || 'Unbekannter Trainer',
      team: entry.teams?.name || '–',
      activity: entry.activity || '',
      cost: toNumber(entry.cost),
      notes: entry.notes || '',
    });
  });

  applyColumnFormatting(sheet);

  const { totalHours, totalCost } = calculateTotals(trainerEntries);

  const hoursRow = sheet.addRow(['Gesamtdauer (Stunden)', totalHours]);
  styleSummaryRow(hoursRow, '0.00');

  const costRow = sheet.addRow(['Gesamtkosten', totalCost]);
  styleSummaryRow(costRow, '#,##0.00 [$€-407]');

  sheet.addRow([]);

  const dateRow = sheet.addRow(['Datum:', '', '', '']);
  styleSignatureRow(sheet, dateRow, 'B');

  sheet.addRow([]);

  const signatureRow1 = sheet.addRow(['Unterschrift:', '', '', '']);
  styleSignatureRow(sheet, signatureRow1, 'B');

  const signatureRow2 = sheet.addRow(['Unterschrift:', '', '', '']);
  styleSignatureRow(sheet, signatureRow2, 'B');

  autoSizeColumns(sheet);

  return workbook.xlsx.writeBuffer();
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

function calculateTotals(entries) {
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + toNumber(entry.duration_minutes),
    0
  );
  const totalCost = entries.reduce((sum, entry) => sum + toNumber(entry.cost), 0);
  const totalHours = totalMinutes / 60;

  return { totalMinutes, totalHours, totalCost };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDate(dateStr) {
  return dateStr ? new Date(dateStr) : '';
}

function toExcelTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  return (hours * 60 + minutes) / (24 * 60);
}

function addTitleRow(sheet, entries, monthFilter, trainerName) {
  const monthLabel = buildMonthLabel(entries, monthFilter);
  const title = `Leistungsnachweis – ${monthLabel} – ${trainerName || 'Unbekannter Trainer'}`;
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells('A1:H1');
  titleRow.height = 24;
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F0FA' },
  };
}

function buildMonthLabel(entries, monthFilter) {
  const baseDate = monthFilter
    ? new Date(`${monthFilter}-01T00:00:00`)
    : toDate(entries[0]?.date) || new Date();

  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(baseDate);
}

function styleHeaderRow(sheet, headerRow) {
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' },
  };

  headerRow.eachCell((cell) => {
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF999999' } },
    };
  });

  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: sheet.columnCount },
  };
}

function applyColumnFormatting(sheet) {
  sheet.getColumn('date').numFmt = 'dd.mm.yyyy';
  sheet.getColumn('start').numFmt = 'hh:mm';
  sheet.getColumn('end').numFmt = 'hh:mm';
  sheet.getColumn('duration').numFmt = '0';
  sheet.getColumn('cost').numFmt = '#,##0.00 [$€-407]';

  ['date', 'start', 'end', 'duration', 'cost'].forEach((key) => {
    sheet.getColumn(key).alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

function styleSummaryRow(row, numberFormat) {
  row.font = { bold: true };
  row.getCell(1).alignment = { horizontal: 'left' };
  row.getCell(2).numFmt = numberFormat;
  row.getCell(2).alignment = { horizontal: 'right' };

  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FBFF' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  });
}

function styleSignatureRow(sheet, row, startColumn) {
  row.getCell(1).font = { bold: true };
  const startColIndex = columnIndexFromLetter(startColumn);
  const endColIndex = startColIndex + 2;
  sheet.mergeCells(row.number, startColIndex, row.number, endColIndex);
  const mergedCell = row.getCell(startColIndex);
  mergedCell.border = {
    bottom: { style: 'thin', color: { argb: 'FF7F7F7F' } },
  };
}

function columnIndexFromLetter(letter) {
  return letter.toUpperCase().charCodeAt(0) - 64;
}

function autoSizeColumns(sheet) {
  sheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value?.result || cell.value || '';
      const length = cellValue.toString().length;
      if (length > maxLength) {
        maxLength = length;
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 10), 40);
  });
}

function downloadExcelBuffer(buffer, trainerName, month) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, buildFileName(trainerName, month));
}

async function downloadZip(files, month) {
  const zip = new JSZip();

  files.forEach(({ trainerName, buffer }) => {
    zip.file(buildFileName(trainerName, month), buffer);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, buildZipFileName(month));
}

function buildZipFileName(month) {
  const monthPart = month ? `_${month}` : '';
  return `leistungsnachweise${monthPart}.zip`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
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
