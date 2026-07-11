import Link from 'next/link';
import { MESSAGES } from '@momus/shared/messages';

export default function BugBudgetPage() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 style={{ color: 'var(--bb-primary)', margin: 0 }}>Bug Budget</h1>
          <p style={{ color: 'var(--bb-secondary)' }}>{MESSAGES.M19}</p>
        </div>
        <Link
          href="/settings/atlassian#bug-budget"
          style={{
            display: 'inline-block',
            padding: '0.55rem 0.9rem',
            borderRadius: 6,
            background: 'var(--bb-primary)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Settings
        </Link>
      </header>

      <section
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '2rem',
          border: '1px solid #dee2e6',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginTop: 0 }}>{MESSAGES.M05}</h2>
        <p>{MESSAGES.M06}</p>
        <p style={{ color: 'var(--bb-secondary)', fontSize: '0.875rem' }}>
          Configure Jira under{' '}
          <Link href="/settings/atlassian#bug-budget">Atlassian Settings</Link>, then run a sync.
        </p>
      </section>
    </main>
  );
}
