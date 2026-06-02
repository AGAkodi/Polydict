import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PolyDict | Real-Time Polymarket AI Trading Desk',

  description: 'AI-Powered prediction market intelligence and sentiment resolver with real-time Polymarket Gamma & CLOB integration.',
  authors: [{ name: 'Antigravity DeepMind' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
        {/* Main Application Container */}
        {children}
      </body>
    </html>
  );
}
