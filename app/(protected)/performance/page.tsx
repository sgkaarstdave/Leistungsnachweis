'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { PerformanceEntry, Trainer } from '@/types';

const formatDate = (value: string) => new Date(value).toLocaleDateString('de-DE');

export default function PerformancePage() {
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTrainer, setFilterTrainer] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    trainer_id: '',
    date: '',
    start_time: '',
    end_time: '',
    duration_minutes: '',
    activity: '',
    location: '',
    notes: '',
    hourly_rate: ''
  });

  useEffect(() => {
    fetchTrainers();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [filterTrainer, periodFrom, periodTo]);

  const fetchTrainers = async () => {
    const { data, error } = await supabase.from('trainers').select('*').order('name');
    if (error) setError(error.message);
    else setTrainers(data as Trainer[]);
  };

  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase
      .from('performance_entries')
      .select('*, trainer:trainer_id(id, name, hourly_rate)')
      .order('date', { ascending: false });
    if (filterTrainer) query = query.eq('trainer_id', filterTrainer);
    if (periodFrom) query = query.gte('date', periodFrom);
    if (periodTo) query = query.lte('date', periodTo);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setEntries(data as PerformanceEntry[]);
    setLoading(false);
  };

  const handleTrainerChange = (trainerId: string) => {
    setForm((prev) => {
      const trainer = trainers.find((t) => t.id === trainerId);
      return {
        ...prev,
        trainer_id: trainerId,
        hourly_rate: trainer?.hourly_rate ? trainer.hourly_rate.toString() : prev.hourly_rate
      };
    });
  };

  const calculateDuration = () => {
    if (form.start_time && form.end_time) {
      const start = new Date(`1970-01-01T${form.start_time}:00`);
      const end = new Date(`1970-01-01T${form.end_time}:00`);
      const diff = (end.getTime() - start.getTime()) / 60000;
      return diff > 0 ? diff : 0;
    }
    return form.duration_minutes ? Number(form.duration_minutes) : 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.trainer_id || !form.date) {
      setError('Bitte Trainer und Datum auswählen');
      return;
    }
    const duration = calculateDuration();
    const hourlyRate = form.hourly_rate ? Number(form.hourly_rate) : 0;
    const cost = duration && hourlyRate ? (duration / 60) * hourlyRate : null;
    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('performance_entries').insert({
      trainer_id: form.trainer_id,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      duration_minutes: duration || null,
      activity: form.activity || null,
      location: form.location || null,
      notes: form.notes || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      cost,
      created_by: userData.user?.id ?? null
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm({
      trainer_id: '',
      date: '',
      start_time: '',
      end_time: '',
      duration_minutes: '',
      activity: '',
      location: '',
      notes: '',
      hourly_rate: ''
    });
    setFormOpen(false);
    fetchEntries();
  };

  const exportExcel = async () => {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError('Bitte erneut anmelden.');
      return;
    }
    try {
      // Download-Logik: Filter an API senden und Blob speichern
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({
          period_from: periodFrom || null,
          period_to: periodTo || null,
          trainer_id: filterTrainer || null
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Export fehlgeschlagen');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leistungsnachweise.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + ((entry.duration_minutes ?? 0) / 60), 0);
  }, [entries]);

  const totalCosts = useMemo(() => {
    return entries.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leistungsnachweise</h1>
        <div className="space-x-2">
          <button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setFormOpen(true)}>
            Neuer Eintrag
          </button>
          <button className="bg-green-600 text-white hover:bg-green-700" onClick={exportExcel}>
            Excel-Export
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Trainer</label>
          <select value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)}>
            <option value="">Alle</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Datum von</label>
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Datum bis</label>
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="table-container">
        {loading ? (
          <div className="p-4">Lade Einträge...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Trainer</th>
                <th>Tätigkeit</th>
                <th>Dauer (Std)</th>
                <th>Kosten (€)</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td>{formatDate(entry.date)}</td>
                  <td>{entry.trainer?.name}</td>
                  <td>{entry.activity}</td>
                  <td>{((entry.duration_minutes ?? 0) / 60).toFixed(2)}</td>
                  <td>{(entry.cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 flex space-x-6 text-sm text-gray-700">
        <div>Summe Stunden: {totalHours.toFixed(2)}</div>
        <div>Summe Kosten: {totalCosts.toFixed(2)} €</div>
      </div>

      {formOpen && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Neuer Leistungsnachweis</h2>
            <button className="text-gray-700" onClick={() => setFormOpen(false)}>
              Schließen
            </button>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Trainer</label>
              <select
                value={form.trainer_id}
                onChange={(e) => handleTrainerChange(e.target.value)}
                required
              >
                <option value="">Bitte wählen</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Datum</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Startzeit</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Endzeit</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dauer (Minuten)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                placeholder="Falls keine Zeiten angegeben"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tätigkeit</label>
              <input value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ort</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notizen</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stundensatz (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                placeholder="Übernahme aus Trainer-Profil"
              />
            </div>
            <div className="md:col-span-2 flex space-x-3">
              <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                Speichern
              </button>
              <button type="button" className="bg-gray-100 text-gray-800" onClick={() => setFormOpen(false)}>
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
