import Link from 'next/link';
import { MESSAGES } from '@momus/shared/messages';

const HUB_LINKS = [
  {
    href: '/analytics',
    title: 'Defect Analytics',
    description: 'Trends, summary metrics, and month-over-month comparisons',
  },
  {
    href: '/bug-budget',
    title: 'Bug Budget Dashboard',
    description: 'Browse, filter, and export bug and defect issues',
  },
  {
    href: '/settings/atlassian#bug-budget',
    title: 'Atlassian Settings',
    description: 'Jira connection, sync, and bug budget configuration',
  },
] as const;

export default function HomePage() {
  return (
    <main className="bb-hub">
      <header className="bb-hub-header">
        <h1>Momus</h1>
        <p>{MESSAGES.M19}</p>
      </header>

      <nav className="bb-hub-nav" aria-label="Momus modules">
        {HUB_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="bb-hub-card">
            <h2>{link.title}</h2>
            <p>{link.description}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
