/**
 * ai_draft_reply: the draft in a text field. The user edits it and sends it or stores it as a
 * draft, which calls conversation_reply with exactly the text on screen. A host that does not
 * let widgets call tools gets the text to copy instead.
 */

import { useEffect, useState } from 'react';
import { mount, useCallTool, useLocale, useTellModel, useToolData } from '../app';
import { texts } from '../i18n';
import { Badge, Button, Card, Loaded } from '../ui';

interface Draft {
  organizationId: string;
  conversationId: string;
  draft: string;
}

type Outcome = 'sent' | 'draftSaved';

function Editor({ data }: { data: Draft }) {
  const t = texts(useLocale());
  const callTool = useCallTool();
  const tellModel = useTellModel();
  const [text, setText] = useState(data.draft);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => setText(data.draft), [data.draft]);

  const submit = async (asDraft: boolean) => {
    if (!callTool || busy || !text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await callTool('conversation_reply', {
        organizationId: data.organizationId,
        conversationId: data.conversationId,
        message: text,
        ...(asDraft ? { draft: true } : {}),
      });
      setOutcome(asDraft ? 'draftSaved' : 'sent');
      await tellModel(
        asDraft
          ? `The user stored this text as a draft in conversation ${data.conversationId}:\n${text}`
          : `The user sent this reply in conversation ${data.conversationId} from the widget; do not send it again:\n${text}`,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access in this host: the text stays selectable
    }
  };

  if (!data.draft) {
    return (
      <Card>
        <p className="fr-muted">{t('emptyDraft')}</p>
      </Card>
    );
  }

  return (
    <Card accent>
      <div className="fr-head">
        <h2 className="fr-title">{t('replyDraft')}</h2>
        {outcome && <Badge tone="success">{t(outcome)}</Badge>}
      </div>
      <textarea
        className="fr-textarea"
        name="reply"
        aria-label={t('replyDraft')}
        value={text}
        readOnly={outcome === 'sent'}
        onChange={(event) => setText(event.target.value)}
      />
      {error && (
        <p className="fr-muted" role="alert">
          {error}
        </p>
      )}
      {outcome !== 'sent' && (
        <div className="fr-row">
          {callTool && (
            <>
              <Button primary disabled={busy || !text.trim()} onClick={() => submit(false)}>
                {busy ? t('sending') : t('send')}
              </Button>
              <Button disabled={busy || !text.trim()} onClick={() => submit(true)}>
                {t('saveDraft')}
              </Button>
            </>
          )}
          <Button onClick={copy}>{copied ? t('copied') : t('copy')}</Button>
        </div>
      )}
      <p className="fr-muted">{callTool ? t('replyDraftHint') : t('sendInChat')}</p>
    </Card>
  );
}

function ReplyDraft() {
  const tool = useToolData<Draft>();
  return <Loaded tool={tool}>{(data) => <Editor data={data} />}</Loaded>;
}

mount('FirstReply reply draft', <ReplyDraft />);
