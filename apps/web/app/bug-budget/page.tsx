import { MESSAGES } from '@momus/shared/messages';

export default function BugBudgetPage() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--bb-primary)', margin: 0 }}>🐞 Bug Budget</h1>
        <p style={{ color: 'var(--bb-secondary)' }}>{MESSAGES.M19}</p>
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
          Database connected — awaiting Jira sync (Phase 2).
        </p>
      </section>
    </main>
  );
}
