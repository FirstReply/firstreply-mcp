/**
 * Widgets (MCP Apps): small HTML views a host such as Claude or ChatGPT renders next to a
 * tool's result. Each is one self-contained file built from web/src into web/dist and served
 * as the resource ui://firstreply/<Name>.html; TOOL_WIDGETS says which tool shows which.
 *
 * What the model reads is the tool's text result, on every host; structuredContent is the
 * widget's view of the same data. So an id a follow-up call needs is always in the text, and
 * the widget data only repeats what the text already says, trimmed to what is shown.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

export const WIDGET_NAMES = ['ConversationList', 'ReplyDraft', 'PostCard', 'PostAnalytics', 'ResultCard'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

const DESCRIPTIONS: Record<WidgetName, string> = {
  ConversationList: 'Customer conversations with contact, subject, status, priority and the last message',
  ReplyDraft: 'An AI reply draft for a conversation that can be edited and sent',
  PostCard: 'A social post with its text, schedule and the status per channel',
  PostAnalytics: 'Publishing analytics: totals, views per day and numbers per channel',
  ResultCard: 'Confirms an action, such as a sent reply or a channel sign-in link',
};

export const widgetUri = (name: WidgetName): string => `ui://firstreply/${name}.html`;

/** web/dist next to dist/ (and in the package). */
const WIDGET_DIR = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export function readWidget(name: WidgetName): Promise<string> {
  return readFile(`${WIDGET_DIR}${name}.html`, 'utf8');
}

/**
 * `_meta` of a widget resource. No `ui.domain`: Claude accepts only its own value there and
 * stops rendering otherwise; ChatGPT's dedicated origin goes in its own key.
 */
export function widgetResourceMeta(name: WidgetName): Record<string, unknown> {
  return {
    ui: { csp: { connectDomains: [], resourceDomains: ['https://assets.claude.ai'] }, prefersBorder: false },
    'openai/widgetDomain': 'https://mcp.firstreply.ai',
    'openai/widgetDescription': DESCRIPTIONS[name],
  };
}

export const widgetDescription = (name: WidgetName): string => DESCRIPTIONS[name];

interface ToolWidget {
  widget: WidgetName;
  /** Status lines while the tool runs and once it finished (ChatGPT), at most 64 characters. */
  invoking: string;
  invoked: string;
}

export const TOOL_WIDGETS: Record<string, ToolWidget> = {
  conversation_list: { widget: 'ConversationList', invoking: 'Loading conversations', invoked: 'Conversations loaded' },
  ai_draft_reply: { widget: 'ReplyDraft', invoking: 'Writing a draft', invoked: 'Draft ready' },
  post_get: { widget: 'PostCard', invoking: 'Loading the post', invoked: 'Post loaded' },
  post_create: { widget: 'PostCard', invoking: 'Saving the draft', invoked: 'Draft saved' },
  post_schedule: { widget: 'PostCard', invoking: 'Scheduling the post', invoked: 'Post scheduled' },
  post_reschedule: { widget: 'PostCard', invoking: 'Rescheduling the post', invoked: 'Post rescheduled' },
  post_analytics: { widget: 'PostAnalytics', invoking: 'Loading analytics', invoked: 'Analytics loaded' },
  conversation_reply: { widget: 'ResultCard', invoking: 'Sending the reply', invoked: 'Reply sent' },
  conversation_close: { widget: 'ResultCard', invoking: 'Closing the conversation', invoked: 'Conversation closed' },
  channel_connect: { widget: 'ResultCard', invoking: 'Preparing the sign-in', invoked: 'Sign-in link ready' },
  channel_create: { widget: 'ResultCard', invoking: 'Creating the channel', invoked: 'Channel created' },
  channel_update: { widget: 'ResultCard', invoking: 'Updating the channel', invoked: 'Channel updated' },
};

/** Descriptor `_meta` of a tool that renders a widget, undefined for a plain tool. */
export function toolWidgetMeta(toolName: string): Record<string, unknown> | undefined {
  const link = Object.hasOwn(TOOL_WIDGETS, toolName) ? TOOL_WIDGETS[toolName] : undefined;
  if (!link) return undefined;
  return {
    ui: { resourceUri: widgetUri(link.widget), visibility: ['model', 'app'] },
    'openai/toolInvocation/invoking': link.invoking,
    'openai/toolInvocation/invoked': link.invoked,
  };
}

// ---------------------------------------------------------------------------
// Widget data
// ---------------------------------------------------------------------------

type Json = Record<string, any>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const clip = (text: unknown, max: number): string | undefined => {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

function contactName(contact: Json | undefined): string | undefined {
  if (!contact) return undefined;
  const full = [contact.firstname, contact.lastname].filter(Boolean).join(' ');
  return contact.name || full || contact.email || undefined;
}

function conversationRow(conversation: Json): Json {
  const last = isObject(conversation.lastMessage) ? conversation.lastMessage : undefined;
  return {
    id: conversation.id,
    subject: clip(conversation.subject, 120),
    status: conversation.status,
    priority: conversation.priority,
    spam: conversation.spam || undefined,
    hasDraft: conversation.hasDraft || undefined,
    kind: conversation.kind || undefined,
    contact: contactName(isObject(conversation.contact) ? conversation.contact : undefined),
    classification: isObject(conversation.classification) ? conversation.classification.name : undefined,
    assignee: isObject(conversation.assignedMember)
      ? conversation.assignedMember.name || conversation.assignedMember.email
      : undefined,
    preview: clip(conversation.searchSnippet ?? last?.translation ?? last?.messagePlain, 160),
    updated: conversation.lastUpdate,
  };
}

function postView(post: Json): Json {
  return {
    id: post.id,
    status: post.status,
    content: typeof post.content === 'string' ? post.content.slice(0, 3000) : undefined,
    scheduledAt: post.scheduledAt ?? undefined,
    publishedAt: post.publishedAt,
    timezone: post.timezone ?? undefined,
    author: post.authorName,
    media: Array.isArray(post.media) ? post.media.length : 0,
    targets: (Array.isArray(post.targets) ? post.targets : []).map((target: Json) => ({
      channelId: target.channelId,
      platform: target.platform,
      status: target.status,
      content: typeof target.content === 'string' ? target.content.slice(0, 3000) : undefined,
      url: target.externalUrl,
      error: clip(target.error, 200),
    })),
  };
}

function analyticsView(analytics: Json): Json {
  const { topPosts, ...totals } = analytics;
  return {
    ...totals,
    topPosts: (Array.isArray(topPosts) ? topPosts : []).slice(0, 3).map((post: Json) => ({
      id: post.id,
      content: clip(post.content, 140),
      publishedAt: post.publishedAt,
      views: (post.targets ?? []).reduce((sum: number, target: Json) => sum + (target.views ?? 0), 0),
      likes: (post.targets ?? []).reduce((sum: number, target: Json) => sum + (target.likes ?? 0), 0),
    })),
  };
}

function replyTitle(args: Json): string {
  if (args.internal) return 'Internal note added';
  return args.draft ? 'Draft saved' : 'Reply sent';
}

/**
 * What the widget of a tool shows, built from the tool's arguments and its result; undefined
 * for a tool without a widget or a result the widget has nothing to show for.
 */
export function widgetData(toolName: string, args: Json, result: unknown): Json | undefined {
  if (!Object.hasOwn(TOOL_WIDGETS, toolName) || !isObject(result)) return undefined;
  const organizationId = args.organizationId as string | undefined;
  switch (toolName) {
    case 'conversation_list':
      return {
        organizationId,
        conversations: (Array.isArray(result.items) ? result.items : []).filter(isObject).map(conversationRow),
      };
    case 'ai_draft_reply':
      return { organizationId, conversationId: args.conversationId, draft: typeof result.result === 'string' ? result.result : '' };
    case 'post_get':
    case 'post_create':
    case 'post_schedule':
    case 'post_reschedule':
      return { organizationId, post: postView(result) };
    case 'post_analytics':
      return { organizationId, analytics: analyticsView(result) };
    case 'conversation_reply':
      return { title: replyTitle(args), text: clip(args.message, 400), tone: 'success' };
    case 'conversation_close':
      return { title: 'Conversation closed', text: clip(result.subject, 160), tone: 'success' };
    case 'channel_connect':
      return {
        title: 'Sign in to connect the account',
        text: 'Open the link in a browser where you are signed in to FirstReply. It is valid for 10 minutes.',
        link: typeof result.authUrl === 'string' ? { url: result.authUrl, label: 'Open sign-in' } : undefined,
        tone: 'info',
      };
    case 'channel_create':
    case 'channel_update':
      return {
        title: toolName === 'channel_create' ? 'Channel created' : 'Channel updated',
        text: [result.name, result.type].filter(Boolean).join(' · ') || undefined,
        tone: 'success',
      };
    default:
      return undefined;
  }
}
