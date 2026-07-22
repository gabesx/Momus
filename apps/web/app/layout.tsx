import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { MESSAGES } from '@momus/shared/messages';
import { AppHeader } from '@/components/layout/app-header';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Momus — Bug Budget',
  description: MESSAGES.M19,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <div className="bb-app-shell">
          <AppHeader />
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
