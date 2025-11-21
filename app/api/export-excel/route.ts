import { supabase } from '@/lib/supabaseClient';
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new NextResponse('Nicht autorisiert', { status: 401 });
  }

  // Session/Token prüfen
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return new NextResponse('Ungültige Session', { status: 401 });
  }

  const body = await request.json();
  const { period_from, period_to, trainer_id } = body as {
    period_from?: string | null;
    period_to?: string | null;
    trainer_id?: string | null;
  };

  let query = supabase
    .from('performance_entries')
    .select('*, trainer:trainer_id(id, name, hourly_rate)')
    .order('date', { ascending: true });

  if (trainer_id) query = query.eq('trainer_id', trainer_id);
  if (period_from) query = query.gte('date', period_from);
  if (period_to) query = query.lte('date', period_to);

  const { data: entries, error } = await query;
  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  // Einträge nach Trainer gruppieren
  const grouped = (entries || []).reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = (entry as any).trainer_id as string;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});

  const workbook = new ExcelJS.Workbook();

  Object.entries(grouped).forEach(([trainerId, trainerEntries]) => {
    const trainerName = (trainerEntries[0] as any).trainer?.name || `Trainer-${trainerId}`;
    const sheet = workbook.addWorksheet(trainerName.slice(0, 30));

    // Kopfbereich
    sheet.addRow(['Leistungsnachweis']);
    sheet.addRow([`Trainer: ${trainerName}`]);
    sheet.addRow([`Zeitraum: ${period_from || 'alle'} - ${period_to || 'alle'}`]);
    sheet.addRow([]);

    sheet.addRow(['Datum', 'Startzeit', 'Endzeit', 'Dauer (Std)', 'Tätigkeit', 'Ort', 'Kosten (€)']);

    let totalHours = 0;
    let totalCost = 0;

    trainerEntries.forEach((entry: any) => {
      const hours = (entry.duration_minutes || 0) / 60;
      totalHours += hours;
      totalCost += entry.cost || 0;
      sheet.addRow([
        entry.date,
        entry.start_time || '',
        entry.end_time || '',
        hours,
        entry.activity || '',
        entry.location || '',
        entry.cost || 0
      ]);
    });

    sheet.addRow([]);
    sheet.addRow(['', '', 'Summe Stunden', totalHours]);
    sheet.addRow(['', '', 'Summe Kosten', totalCost]);
    sheet.addRow([]);
    sheet.addRow(['Unterschrift Trainer: _____________________']);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as Buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="leistungsnachweise.xlsx"'
    }
  });
}
