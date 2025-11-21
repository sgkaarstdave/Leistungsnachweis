import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leistungsnachweis',
  description: 'Stundenerfassung und Exporte'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
