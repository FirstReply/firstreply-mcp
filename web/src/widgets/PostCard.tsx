/** post_get, post_create, post_schedule, post_reschedule: the post, its time and each channel. */

import { mount, useLocale, useOpenLink, useTimeZone, useToolData } from '../app';
import { formatDateTime, platformName, texts, type TextKey } from '../i18n';
import { Badge, Button, Card, Loaded, type Tone } from '../ui';

interface Target {
  channelId: string;
  platform?: string;
  status?: string;
  content?: string;
  url?: string;
  error?: string;
}

interface Post {
  id: string;
  status?: string;
  content?: string;
  scheduledAt?: number;
  publishedAt?: number;
  timezone?: string;
  author?: string;
  media: number;
  targets: Target[];
}

const TONES: Record<string, Tone> = {
  SCHEDULED: 'accent',
  QUEUED: 'accent',
  PUBLISHING: 'accent',
  PUBLISHED: 'success',
  PENDING_APPROVAL: 'warning',
  PARTIALLY_FAILED: 'danger',
  FAILED: 'danger',
};

function Status({ status }: { status?: string }) {
  const t = texts(useLocale());
  if (!status) return null;
  return <Badge tone={TONES[status] ?? 'neutral'}>{status in TONES || status === 'DRAFT' ? t(status as TextKey) : status}</Badge>;
}

function PostView({ post }: { post: Post }) {
  const locale = useLocale();
  const t = texts(locale);
  const hostZone = useTimeZone();
  const openLink = useOpenLink();
  // The post's own time zone is the one its author planned in
  const zone = post.timezone || hostZone;
  const when = post.publishedAt
    ? `${t('publishedOn')} ${formatDateTime(post.publishedAt, locale, zone)}`
    : post.scheduledAt
      ? `${t('scheduledFor')} ${formatDateTime(post.scheduledAt, locale, zone)}`
      : t('notScheduled');

  return (
    <Card accent={post.status === 'SCHEDULED'}>
      <div className="fr-head">
        <h2 className="fr-title">{when}</h2>
        <Status status={post.status} />
      </div>
      {post.content && <p className="fr-text">{post.content}</p>}
      {post.media > 0 && (
        <p className="fr-muted">
          {post.media} {t('media')}
        </p>
      )}
      <ul className="fr-list">
        {post.targets.map((target) => (
          <li key={target.channelId}>
            <div className="fr-row">
              <span className="fr-strong fr-grow">{platformName(target.platform)}</span>
              {target.content && <Badge>{t('ownText')}</Badge>}
              {target.status !== post.status && <Status status={target.status} />}
              {target.url && <Button onClick={() => openLink(target.url!)}>{t('view')}</Button>}
            </div>
            {target.content && <p className="fr-muted fr-text">{target.content}</p>}
            {target.error && (
              <p className="fr-muted" role="alert">
                {target.error}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="fr-row">
        <Button onClick={() => openLink(`https://app.firstreply.ai/publishing/posts/${encodeURIComponent(post.id)}`)}>
          {t('openInFirstReply')}
        </Button>
        {post.author && <span className="fr-muted">{post.author}</span>}
      </div>
    </Card>
  );
}

function PostCard() {
  const tool = useToolData<{ post: Post }>();
  return <Loaded tool={tool}>{({ post }) => <PostView post={post} />}</Loaded>;
}

mount('FirstReply post', <PostCard />);
