/** The widgets' texts in English and German; the host's locale picks one. */

const en = {
  loading: 'Loading',
  failed: 'This could not be loaded.',
  noConversations: 'No conversations match.',
  unread: 'Unread',
  read: 'Open',
  closed: 'Closed',
  spam: 'Spam',
  draft: 'Draft',
  comment: 'Comment',
  highPriority: 'High priority',
  unknownContact: 'Unknown contact',
  noSubject: 'No subject',
  replyDraft: 'Reply draft',
  replyDraftHint: 'Written by FirstReply AI from your knowledge base. Edit it before sending.',
  emptyDraft: 'No draft could be written for this conversation.',
  send: 'Send reply',
  saveDraft: 'Save as draft',
  copy: 'Copy',
  copied: 'Copied',
  sending: 'Sending',
  sent: 'Reply sent',
  draftSaved: 'Draft saved in FirstReply',
  sendInChat: 'Ask the assistant to send it, or copy the text.',
  post: 'Post',
  scheduledFor: 'Scheduled for',
  publishedOn: 'Published',
  notScheduled: 'Not scheduled',
  ownText: 'Own text',
  media: 'media',
  openInFirstReply: 'Open in FirstReply',
  view: 'View',
  analytics: 'Publishing analytics',
  posts: 'Posts',
  views: 'Views',
  reach: 'Reach',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  clicks: 'Clicks',
  engagement: 'Engagement',
  viewsPerDay: 'Views per day',
  channels: 'Channels',
  followers: 'followers',
  topPosts: 'Top posts',
  noAnalytics: 'No posts were published in this period.',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  SCHEDULED: 'Scheduled',
  QUEUED: 'Queued',
  PUBLISHING: 'Publishing',
  PUBLISHED: 'Published',
  PARTIALLY_FAILED: 'Partly failed',
  FAILED: 'Failed',
};

const de: typeof en = {
  loading: 'Wird geladen',
  failed: 'Das konnte nicht geladen werden.',
  noConversations: 'Keine passenden Konversationen.',
  unread: 'Ungelesen',
  read: 'Offen',
  closed: 'Geschlossen',
  spam: 'Spam',
  draft: 'Entwurf',
  comment: 'Kommentar',
  highPriority: 'Hohe Priorität',
  unknownContact: 'Unbekannter Kontakt',
  noSubject: 'Kein Betreff',
  replyDraft: 'Antwortentwurf',
  replyDraftHint: 'Von FirstReply AI aus Ihrer Wissensdatenbank geschrieben. Bearbeiten Sie ihn vor dem Senden.',
  emptyDraft: 'Für diese Konversation konnte kein Entwurf geschrieben werden.',
  send: 'Antwort senden',
  saveDraft: 'Als Entwurf speichern',
  copy: 'Kopieren',
  copied: 'Kopiert',
  sending: 'Wird gesendet',
  sent: 'Antwort gesendet',
  draftSaved: 'Entwurf in FirstReply gespeichert',
  sendInChat: 'Bitten Sie den Assistenten, sie zu senden, oder kopieren Sie den Text.',
  post: 'Beitrag',
  scheduledFor: 'Geplant für',
  publishedOn: 'Veröffentlicht',
  notScheduled: 'Nicht geplant',
  ownText: 'Eigener Text',
  media: 'Medien',
  openInFirstReply: 'In FirstReply öffnen',
  view: 'Ansehen',
  analytics: 'Auswertung der Beiträge',
  posts: 'Beiträge',
  views: 'Aufrufe',
  reach: 'Reichweite',
  likes: 'Likes',
  comments: 'Kommentare',
  shares: 'Geteilt',
  clicks: 'Klicks',
  engagement: 'Interaktionen',
  viewsPerDay: 'Aufrufe pro Tag',
  channels: 'Kanäle',
  followers: 'Follower',
  topPosts: 'Beste Beiträge',
  noAnalytics: 'In diesem Zeitraum wurde nichts veröffentlicht.',
  DRAFT: 'Entwurf',
  PENDING_APPROVAL: 'Wartet auf Freigabe',
  SCHEDULED: 'Geplant',
  QUEUED: 'In Warteschlange',
  PUBLISHING: 'Wird veröffentlicht',
  PUBLISHED: 'Veröffentlicht',
  PARTIALLY_FAILED: 'Teilweise fehlgeschlagen',
  FAILED: 'Fehlgeschlagen',
};

export type TextKey = keyof typeof en;

export function texts(locale: string): (key: TextKey) => string {
  const dictionary = locale.toLowerCase().startsWith('de') ? de : en;
  return (key) => dictionary[key];
}

export const PLATFORMS: Record<string, string> = {
  EMAIL: 'Email',
  WEBCHAT: 'Website chat',
  MESSENGER: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  WHATSAPP: 'WhatsApp',
  THREADS: 'Threads',
  X: 'X',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  GOOGLE_BUSINESS: 'Google Business Profile',
  BLUESKY: 'Bluesky',
  MASTODON: 'Mastodon',
  TELEGRAM: 'Telegram',
  APPSTORE: 'App Store',
  PLAYSTORE: 'Google Play',
};

export const platformName = (platform: string | undefined): string => (platform && PLATFORMS[platform]) || platform || '';

export function formatDateTime(millis: number | undefined | null, locale: string, timeZone?: string): string {
  if (!millis) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(millis);
  } catch {
    return new Date(millis).toLocaleString();
  }
}

/** "3 hours ago" for the last days, a date after that. */
export function formatAgo(millis: number | undefined, locale: string, now = Date.now()): string {
  if (!millis) return '';
  const minutes = Math.round((millis - now) / 60_000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return relative.format(Math.round(minutes / 60), 'hour');
  if (Math.abs(minutes) < 60 * 24 * 7) return relative.format(Math.round(minutes / 1440), 'day');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(millis);
}

export function formatCount(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
