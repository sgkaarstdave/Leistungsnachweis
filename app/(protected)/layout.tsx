'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verifySession = async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      setCheckingSession(false);

      if (!hasSession) {
        router.replace('/login');
      }
    };

    verifySession();
  }, [router]);

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Prüfe Anmeldung...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
