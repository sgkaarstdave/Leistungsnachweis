'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth-Fluss: aktuelle Session prüfen und Listener setzen
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        router.replace('/login');
      }
    });

    init();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Lade Sitzung...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const navLinkClass = (href: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith(href) ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-gray-100'}`;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-lg font-semibold text-blue-700">
                Leistungsnachweis
              </Link>
              <div className="hidden md:flex space-x-2">
                <Link href="/trainers" className={navLinkClass('/trainers')}>
                  Trainer
                </Link>
                <Link href="/performance" className={navLinkClass('/performance')}>
                  Leistungsnachweise
                </Link>
                <Link href="/profile" className={navLinkClass('/profile')}>
                  Profil
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">{session.user?.email}</div>
              <button onClick={handleLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-800">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
    </div>
  );
}
