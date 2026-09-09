'use client';

type Props = {
  id: string;
  title: string;
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function SetupSection({ id, title, hint, open, onOpenChange, children }: Props) {
  return (
    <details
      id={id}
      className="settings-card bb-setup-section"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next !== open) onOpenChange(next);
      }}
    >
      <summary className="bb-setup-section__summary">
        <span className="bb-setup-section__title">{title}</span>
        {hint ? <span className="bb-setup-section__hint">{hint}</span> : null}
      </summary>
      {open ? <div className="bb-setup-section__body">{children}</div> : null}
    </details>
  );
}
