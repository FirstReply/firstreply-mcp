/**
 * post_analytics: totals, views per day and the numbers per channel. A metric no platform
 * offers is null and is left out instead of shown as zero.
 */

import { mount, useLocale, useToolData } from '../app';
import { formatCount, platformName, texts, type TextKey } from '../i18n';
import { Card, Loaded } from '../ui';

interface Day {
  day: string;
  views?: number | null;
}

interface Channel {
  channelId: string;
  platform?: string;
  name?: string;
  posts?: number | null;
  views?: number | null;
  engagement?: number | null;
  followers?: number | null;
}

interface TopPost {
  id: string;
  content?: string;
  views: number;
  likes: number;
}

interface Analytics {
  posts?: number | null;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  series?: Day[];
  channels?: Channel[];
  topPosts?: TopPost[];
}

const TOTALS: TextKey[] = ['posts', 'views', 'reach', 'likes', 'comments', 'shares', 'clicks', 'engagement'];

/** One bar per day, as plain SVG: no charting library in a widget. */
function DailyChart({ series, label }: { series: Day[]; label: string }) {
  const max = Math.max(1, ...series.map((day) => day.views ?? 0));
  const width = 100 / series.length;
  return (
    <svg className="fr-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
      {series.map((day, index) => {
        const height = Math.max(0.6, ((day.views ?? 0) / max) * 38);
        return (
          <rect key={day.day} x={index * width + width * 0.15} y={40 - height} width={width * 0.7} height={height} rx={0.6}>
            <title>{`${day.day}: ${day.views ?? 0}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function AnalyticsView({ analytics }: { analytics: Analytics }) {
  const locale = useLocale();
  const t = texts(locale);
  const totals = TOTALS.filter((key) => typeof analytics[key as keyof Analytics] === 'number');
  const series = analytics.series ?? [];
  const channels = analytics.channels ?? [];
  const topPosts = analytics.topPosts ?? [];
  const mostViews = Math.max(1, ...channels.map((channel) => channel.views ?? 0));

  if (!analytics.posts && channels.length === 0) {
    return (
      <Card>
        <p className="fr-muted">{t('noAnalytics')}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="fr-title">{t('analytics')}</h2>
      <div className="fr-stats">
        {totals.map((key) => (
          <div className="fr-stat" key={key}>
            <strong>{formatCount(analytics[key as keyof Analytics] as number, locale)}</strong>
            <span>{t(key)}</span>
          </div>
        ))}
      </div>
      {series.some((day) => (day.views ?? 0) > 0) && (
        <div>
          <p className="fr-muted">{t('viewsPerDay')}</p>
          <DailyChart series={series} label={t('viewsPerDay')} />
        </div>
      )}
      {channels.length > 0 && (
        <div>
          <p className="fr-muted">{t('channels')}</p>
          <ul className="fr-list">
            {channels.map((channel) => (
              <li key={channel.channelId}>
                <div className="fr-row">
                  <span className="fr-strong fr-grow">{channel.name || platformName(channel.platform)}</span>
                  <span className="fr-muted">
                    {[
                      typeof channel.views === 'number' ? `${formatCount(channel.views, locale)} ${t('views')}` : '',
                      typeof channel.followers === 'number' ? `${formatCount(channel.followers, locale)} ${t('followers')}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {typeof channel.views === 'number' && (
                  <div className="fr-bar">
                    <i style={{ width: `${(channel.views / mostViews) * 100}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {topPosts.length > 0 && (
        <div>
          <p className="fr-muted">{t('topPosts')}</p>
          <ul className="fr-list">
            {topPosts.map((post) => (
              <li key={post.id}>
                <span className="fr-clamp">{post.content}</span>
                <span className="fr-muted">
                  {formatCount(post.views, locale)} {t('views')} · {formatCount(post.likes, locale)} {t('likes')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function PostAnalytics() {
  const tool = useToolData<{ analytics: Analytics }>();
  return <Loaded tool={tool}>{({ analytics }) => <AnalyticsView analytics={analytics} />}</Loaded>;
}

mount('FirstReply publishing analytics', <PostAnalytics />);
