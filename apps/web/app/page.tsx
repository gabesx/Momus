import Link from 'next/link';
import { MESSAGES } from '@momus/shared/messages';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--bb-primary)', margin: 0 }}>Bug Budget</h1>
        <p style={{ color: 'var(--bb-secondary)', marginTop: '0.5rem' }}>{MESSAGES.M19}</p>
      </header>

      <section
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.5rem',
          border: '1px solid #dee2e6',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Momus</h2>
        <ul>
          <li>
            <Link href="/bug-budget">Bug Budget Dashboard</Link>
          </li>
          <li>
            <Link href="/settings/atlassian#bug-budget">Atlassian Settings</Link>
          </li>
          <li>
            <Link href="/api/health">API Health Check</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
