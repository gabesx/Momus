import type { Metadata } from 'next';
import { MESSAGES } from '@momus/shared/messages';
import { AppHeader } from '@/components/layout/app-header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Momus — Bug Budget',
  description: MESSAGES.M19,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
