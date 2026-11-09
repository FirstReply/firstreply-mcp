/**
 * Social posts: listing, writing with AI, drafting, scheduling, comment threads and analytics.
 *
 * There are deliberately no tools to publish right away, approve, retry or delete:
 * a public post cannot be taken back, so an assistant drafts or schedules and a
 * person can still change the post in FirstReply before it goes out. For the same
 * reason comments are only read here, never moderated or answered privately.
 */

import { z } from 'zod';
import type { FirstReplyClient } from '../client.js';
import {
  add,
  epochMillis,
  LIMIT,
  optDate,
  optEnum,
  optNum,
  optStr,
  optStrList,
  ORG_ID,
  orgPath,
  PAGE,
  paging,
  READ,
  str,
  WRITE,
} from './registry.js';

const POST_ID = str('The post id (see post_list).');
const STATUSES = 'DRAFT, PENDING_APPROVAL, SCHEDULED, PUBLISHING, PUBLISHED, PARTIALLY_FAILED, FAILED';
const CHANNEL_IDS = 'Ids of the channels to post to; only channels with publishingEnabled (see channel_list).';
const TIMEZONE = optStr('IANA time zone the post is planned in, e.g. Europe/Vienna. Shown in the calendar.');
const SCHEDULED_AT = str(
  'When to publish: ISO 8601 date-time with UTC offset, e.g. 2026-11-10T10:00:00+01:00. At least 10 minutes from now.',
);
const APPROVAL_NOTE =
  'When the organization requires approval, a member\'s post waits for a manager (status PENDING_APPROVAL).';

/** Scheduling closer than this would publish (almost) right away, before anyone could look at the post. */
export const MIN_SCHEDULE_LEAD_MS = 10 * 60 * 1000;
const PERMISSION_MANAGER = 2;

interface Post {
  status?: string;
  content?: string;
  timezone?: string;
  targets?: { channelId: string; content?: string | null; settings?: string | null }[];
  media?: { id: string; altText?: string | null }[];
}

const postPath = (organizationId: string, postId = ''): string =>
  orgPath(organizationId, `/posts${postId ? `/${postId}` : ''}`);

/** The publish time in epoch millis, refused when it has no offset or is too soon. */
function scheduleTime(value: string): number {
  if (!/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    throw new Error(`Invalid time "${value}": use an ISO 8601 date-time with UTC offset, e.g. 2026-11-10T10:00:00+01:00.`);
  }
  const millis = epochMillis(value) as number;
  if (millis < Date.now() + MIN_SCHEDULE_LEAD_MS) {
    throw new Error(
      'The time must be at least 10 minutes from now: posts are only scheduled here, so the team can still check them. Publishing right away is done in FirstReply.',
    );
  }
  return millis;
}

/**
 * Saving a post that waits for approval as a manager (an API key acts as the owner)
 * schedules it, which would approve it. Approving is left to a person.
 */
async function refuseImplicitApproval(client: FirstReplyClient, organizationId: string, post: Post): Promise<void> {
  if (post.status !== 'PENDING_APPROVAL') return;
  const organization = (await client.get(orgPath(organizationId))) as { permission?: number };
  if (typeof organization.permission !== 'number' || organization.permission >= PERMISSION_MANAGER) {
    throw new Error('This post is waiting for approval. Approve or change it in FirstReply.');
  }
}

/** The post as the API takes it back: PUT replaces content, channels and media, so all of it is resent. */
function postUpdate(post: Post, channelIds?: string[]) {
  const targets = (post.targets ?? []).map(({ channelId, content, settings }) => ({ channelId, content, settings }));
  return {
    content: post.content,
    timezone: post.timezone,
    targets: channelIds ? channelIds.map((channelId) => targets.find((t) => t.channelId === channelId) ?? { channelId }) : targets,
    media: (post.media ?? []).map(({ id, altText }) => ({ id, altText })),
  };
}

add(
  'post_list',
  'List the social media posts of an organization, newest first (order asc for upcoming posts, soonest first). Each post carries its text, status, scheduled time and its targets (one per channel) with their publish state and latest metrics.',
  {
    organizationId: ORG_ID,
    status: optStr(`Filter by status, several comma-separated: ${STATUSES}.`),
    channelId: optStr('Only posts to this channel.'),
    from: optDate('Only posts planned, published or created at or after this time.'),
    to: optDate('Only posts planned, published or created before this time.'),
    search: optStr('Text the post contains.'),
    order: optEnum(['asc', 'desc'], 'asc lists the soonest first (calendar, upcoming posts); default desc.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.get(postPath(args.organizationId), {
      status: args.status,
      channelId: args.channelId,
      from: epochMillis(args.from),
      to: epochMillis(args.to),
      search: args.search,
      order: args.order,
      ...paging(args),
    }),
);

add(
  'post_get',
  'Get a social media post by id: text, status, schedule, media and its targets (one per channel) with publish state, error, link to the published post and latest metrics.',
  { organizationId: ORG_ID, postId: POST_ID },
  READ,
  (client, args) => client.get(postPath(args.organizationId, args.postId)),
);

add(
  'post_metrics',
  'Metric snapshots (views, reach, likes, comments, shares, saves, clicks) of every target of a published post, oldest first. A metric the platform does not offer is null.',
  { organizationId: ORG_ID, postId: POST_ID },
  READ,
  (client, args) => client.get(postPath(args.organizationId, `${args.postId}/metrics`)),
);

add(
  'post_comments',
  'The comment threads on a published post, newest first. Each thread is a conversation (commenter as contact, status, classification, last message); read one with conversation_thread. Members see the threads they may see in the channel.',
  { organizationId: ORG_ID, postId: POST_ID, page: PAGE, limit: LIMIT },
  READ,
  (client, args) => client.get(postPath(args.organizationId, `${args.postId}/conversations`), paging(args)),
);

add(
  'post_write',
  'Write the text of a social media post with the organization\'s AI: WRITE a post from an instruction (facts come from the knowledge base), or SHORTEN or REWRITE a text. Returns the text, with tooLong when it still exceeds maxLength. Nothing is saved: pass the text to post_create or post_schedule.',
  {
    organizationId: ORG_ID,
    action: z
      .enum(['WRITE', 'SHORTEN', 'REWRITE'])
      .describe('WRITE a new post from the instruction, SHORTEN or REWRITE the text.'),
    instruction: optStr('WRITE: what the post is about. SHORTEN, REWRITE: how to change the text, e.g. "more casual".'),
    text: optStr('The text to shorten or rewrite (required for SHORTEN and REWRITE); for WRITE an optional starting point.'),
    platform: optStr(
      'Type of the channel the text is for (see channel_list), e.g. MESSENGER (Facebook Page), INSTAGRAM or LINKEDIN. Omit for a text that works on several platforms.',
    ),
    maxLength: optNum('Character limit to stay within, e.g. 280 for X.'),
    language: optStr('Two-letter language code. Default: the organization\'s language.'),
  },
  READ,
  (client, args) =>
    client.post(postPath(args.organizationId, 'ai'), {
      action: args.action,
      text: args.text,
      instruction: args.instruction,
      platform: args.platform,
      maxLength: args.maxLength,
      language: args.language,
    }),
);

add(
  'post_create',
  'Save a social media post as a draft. Nothing is published: schedule it with post_schedule or in FirstReply.',
  {
    organizationId: ORG_ID,
    content: str('The text of the post.'),
    channelIds: optStrList(CHANNEL_IDS),
    timezone: TIMEZONE,
  },
  WRITE,
  (client, args) =>
    client.post(postPath(args.organizationId), {
      content: args.content,
      timezone: args.timezone,
      status: 'DRAFT',
      targets: (args.channelIds ?? []).map((channelId) => ({ channelId })),
    }),
);

add(
  'post_schedule',
  `Schedule a social media post for a time: a new post from content and channelIds, or an existing draft (postId; content and channelIds then replace its text and channels). It is published at that time unless someone changes it in FirstReply. ${APPROVAL_NOTE}`,
  {
    organizationId: ORG_ID,
    postId: optStr('An existing post to schedule. Omit to create a new post.'),
    content: optStr('The text of the post. Required for a new post.'),
    channelIds: optStrList(`${CHANNEL_IDS} Required for a new post.`),
    scheduledAt: SCHEDULED_AT,
    timezone: TIMEZONE,
  },
  WRITE,
  async (client, args) => {
    const scheduledAt = scheduleTime(args.scheduledAt);
    if (!args.postId) {
      if (!args.content || !args.channelIds?.length) {
        throw new Error('A new post needs content and at least one channelId.');
      }
      return client.post(postPath(args.organizationId), {
        content: args.content,
        timezone: args.timezone,
        status: 'SCHEDULED',
        scheduledAt,
        targets: args.channelIds.map((channelId) => ({ channelId })),
      });
    }
    const path = postPath(args.organizationId, args.postId);
    const post = (await client.get(path)) as Post;
    await refuseImplicitApproval(client, args.organizationId, post);
    const update = postUpdate(post, args.channelIds?.length ? args.channelIds : undefined);
    return client.put(path, {
      ...update,
      content: args.content ?? update.content,
      timezone: args.timezone ?? update.timezone,
      status: 'SCHEDULED',
      scheduledAt,
    });
  },
);

add(
  'post_reschedule',
  `Move a social media post to another time. Text, channels and media stay; a draft stays a draft with the new planned time. ${APPROVAL_NOTE}`,
  {
    organizationId: ORG_ID,
    postId: POST_ID,
    scheduledAt: SCHEDULED_AT,
    timezone: TIMEZONE,
  },
  WRITE,
  async (client, args) => {
    const scheduledAt = scheduleTime(args.scheduledAt);
    const path = postPath(args.organizationId, args.postId);
    const post = (await client.get(path)) as Post;
    await refuseImplicitApproval(client, args.organizationId, post);
    const update = postUpdate(post);
    return client.put(path, {
      ...update,
      timezone: args.timezone ?? update.timezone,
      status: post.status === 'DRAFT' ? 'DRAFT' : 'SCHEDULED',
      scheduledAt,
    });
  },
);

add(
  'post_analytics',
  'Publishing analytics for a period (default the last 30 days, at most a year): totals, a daily series, top posts and per-channel numbers with followers. A metric no channel offers is null.',
  {
    organizationId: ORG_ID,
    from: optDate('Start of the period (posts published at or after it).'),
    to: optDate('End of the period.'),
    channelId: optStr('Only this channel.'),
  },
  READ,
  (client, args) =>
    client.get(postPath(args.organizationId, 'analytics'), {
      from: epochMillis(args.from),
      to: epochMillis(args.to),
      channelId: args.channelId,
    }),
);
