/** The few building blocks the widgets share. */

import type { ReactNode } from 'react';
import { useLocale, type ToolState } from './app';
import { texts } from './i18n';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <section className={accent ? 'fr-card fr-card-accent' : 'fr-card'}>{children}</section>;
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`fr-badge fr-badge-${tone}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={primary ? 'fr-button fr-button-primary' : 'fr-button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Renders the widget once its data is there; a skeleton before, a line of text when it failed. */
export function Loaded<T>({ tool, children }: { tool: ToolState<T>; children: (data: T) => ReactNode }) {
  const t = texts(useLocale());
  if (tool.state === 'ready') return <>{children(tool.data)}</>;
  if (tool.state === 'failed') {
    return (
      <Card>
        <p className="fr-muted" role="alert">
          {tool.message || t('failed')}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="fr-skeleton" role="status" aria-label={t('loading')}>
        <i />
        <i />
        <i />
      </div>
    </Card>
  );
}
