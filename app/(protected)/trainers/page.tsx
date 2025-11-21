'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Trainer } from '@/types';

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    hourly_rate: '',
    is_active: true
  });

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('trainers').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setTrainers(data as Trainer[]);
    setLoading(false);
  };

  const handleEdit = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setForm({
      name: trainer.name,
      email: trainer.email ?? '',
      hourly_rate: trainer.hourly_rate?.toString() ?? '',
      is_active: trainer.is_active
    });
  };

  const resetForm = () => {
    setEditingTrainer(null);
    setForm({ name: '', email: '', hourly_rate: '', is_active: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      name: form.name,
      email: form.email || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      is_active: form.is_active,
      created_by: userData.user?.id ?? null
    };
    const { error: upsertError } = editingTrainer
      ? await supabase.from('trainers').update(payload).eq('id', editingTrainer.id)
      : await supabase.from('trainers').insert(payload);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    resetForm();
    fetchTrainers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trainer</h1>
        <button
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            resetForm();
            setEditingTrainer(null);
          }}
        >
          Neuer Trainer
        </button>
      </div>

      <form className="bg-white p-6 rounded-lg shadow-sm space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stundensatz (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-sm">Aktiv</span>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex space-x-3">
          <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
            {editingTrainer ? 'Aktualisieren' : 'Anlegen'}
          </button>
          {editingTrainer && (
            <button type="button" className="bg-gray-100 text-gray-800" onClick={resetForm}>
              Abbrechen
            </button>
          )}
        </div>
      </form>

      <div className="table-container">
        {loading ? (
          <div className="p-4">Lade Trainer...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Stundensatz</th>
                <th>Aktiv</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((trainer) => (
                <tr key={trainer.id} className="border-b">
                  <td>{trainer.name}</td>
                  <td>{trainer.email}</td>
                  <td>{trainer.hourly_rate ? `${trainer.hourly_rate.toFixed(2)} €` : '-'}</td>
                  <td>{trainer.is_active ? 'Ja' : 'Nein'}</td>
                  <td>
                    <button className="text-blue-700" onClick={() => handleEdit(trainer)}>
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
