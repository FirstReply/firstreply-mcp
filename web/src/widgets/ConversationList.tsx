/** conversation_list: the conversations as rows, most urgent first as the API returns them. */

import { mount, useLocale, useToolData } from '../app';
import { formatAgo, texts } from '../i18n';
import { Badge, Card, Loaded } from '../ui';

interface Conversation {
  id: string;
  subject?: string;
  /** 0 unread, 1 read, 2 closed */
  status?: number;
  priority?: number;
  spam?: boolean;
  hasDraft?: boolean;
  kind?: string;
  contact?: string;
  classification?: string;
  assignee?: string;
  preview?: string;
  updated?: number;
}

function ConversationList() {
  const locale = useLocale();
  const t = texts(locale);
  const tool = useToolData<{ conversations: Conversation[] }>();
  return (
    <Loaded tool={tool}>
      {({ conversations }) => (
        <Card>
          {conversations.length === 0 ? (
            <p className="fr-muted">{t('noConversations')}</p>
          ) : (
            <ul className="fr-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div className="fr-row">
                    {conversation.status === 0 && <span className="fr-dot" role="img" aria-label={t('unread')} />}
                    <span className="fr-strong fr-grow">{conversation.contact ?? t('unknownContact')}</span>
                    <span className="fr-muted">{formatAgo(conversation.updated, locale)}</span>
                  </div>
                  <div>{conversation.subject ?? t('noSubject')}</div>
                  {conversation.preview && <p className="fr-muted fr-clamp">{conversation.preview}</p>}
                  <div className="fr-row">
                    {conversation.status === 2 && <Badge>{t('closed')}</Badge>}
                    {(conversation.priority ?? 0) > 0 && <Badge tone="danger">{t('highPriority')}</Badge>}
                    {conversation.spam && <Badge tone="warning">{t('spam')}</Badge>}
                    {conversation.kind === 'COMMENT' && <Badge>{t('comment')}</Badge>}
                    {conversation.classification && <Badge tone="accent">{conversation.classification}</Badge>}
                    {conversation.hasDraft && <Badge tone="warning">{t('draft')}</Badge>}
                    {conversation.assignee && <span className="fr-muted">{conversation.assignee}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Loaded>
  );
}

mount('FirstReply conversations', <ConversationList />);
