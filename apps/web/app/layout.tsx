import type { Metadata } from 'next';
import { MESSAGES } from '@momus/shared/messages';
import './globals.css';

export const metadata: Metadata = {
  title: 'Momus — Bug Budget',
  description: MESSAGES.M19,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
