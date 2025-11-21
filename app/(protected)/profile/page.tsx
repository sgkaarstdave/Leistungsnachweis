'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Keine Sitzung');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
    if (error) {
      setError(error.message);
    } else if (data) {
      setProfile(data as Profile);
      setFullName(data.full_name ?? '');
    }
    setLoading(false);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!profile) return;
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
    if (error) setError(error.message);
    else setSuccess(true);
  };

  if (loading) {
    return <p>Lade Profil...</p>;
  }

  if (!profile) return <p>Kein Profil gefunden.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <form className="bg-white p-6 rounded-lg shadow-sm space-y-4 max-w-lg" onSubmit={saveProfile}>
        <div>
          <label className="block text-sm font-medium text-gray-700">Voller Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Rolle</label>
          <input value={profile.role} disabled />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">Profil gespeichert</p>}
        <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
          Speichern
        </button>
      </form>
    </div>
  );
}
