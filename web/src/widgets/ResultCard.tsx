/** Confirms an action (reply sent, channel created) or hands over a link (channel sign-in). */

import { mount, useOpenLink, useToolData } from '../app';
import { Button, Card, Loaded } from '../ui';

interface Result {
  title: string;
  text?: string;
  link?: { url: string; label: string };
  tone?: 'success' | 'info';
}

const CHECK = 'M5 13l4 4L19 7';
const LINK =
  'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1';

function ResultCard() {
  const tool = useToolData<Result>();
  const openLink = useOpenLink();
  return (
    <Loaded tool={tool}>
      {(result) => (
        <Card>
          <div className="fr-row">
            <span className="fr-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={result.link ? LINK : CHECK} />
              </svg>
            </span>
            <div className="fr-grow">
              <h2 className="fr-title">{result.title}</h2>
              {result.text && <p className="fr-muted">{result.text}</p>}
            </div>
            {result.link && (
              <Button primary onClick={() => openLink(result.link!.url)}>
                {result.link.label}
              </Button>
            )}
          </div>
        </Card>
      )}
    </Loaded>
  );
}

mount('FirstReply result', <ResultCard />);
