/**
 * FirstReply MCP tool definitions and handlers.
 *
 * Tools are hand-written with an add() builder (modeled on the Timesheet MCP)
 * and call the FirstReply REST API through FirstReplyClient. All endpoints are
 * organization-scoped and permission-checked server-side.
 */

import { FirstReplyClient } from './client.js';

interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}

type ToolArgs = Record<string, unknown>;
type ToolHandler = (client: FirstReplyClient, args: ToolArgs) => Promise<unknown>;

const STR = (description: string): JsonSchemaProperty => ({ type: 'string', description });
const NUM = (description: string): JsonSchemaProperty => ({ type: 'number', description });

const ORG_ID = STR('The organization id. Use organization_list to find it.');
const CONVERSATION_ID = STR('The conversation id.');

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

const definitions: ToolDefinition[] = [];
const handlers = new Map<string, ToolHandler>();

function humanTitle(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function add(
  name: string,
  description: string,
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
  annotations: ToolDefinition['annotations'],
  handler: ToolHandler,
): void {
  definitions.push({
    name,
    title: humanTitle(name),
    description,
    inputSchema: { type: 'object', properties, required: required.length ? required : undefined },
    annotations,
  });
  handlers.set(name, handler);
}

function str(args: ToolArgs, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required argument: ${key}`);
  }
  return value;
}

function optNum(args: ToolArgs, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' ? value : undefined;
}

function optStr(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function page(args: ToolArgs): number {
  return Math.max(optNum(args, 'page') ?? 1, 1);
}

function limit(args: ToolArgs, fallback = 10, max = 50): number {
  return Math.min(Math.max(optNum(args, 'limit') ?? fallback, 1), max);
}

// ---------------------------------------------------------------------------
// Organization & setup
// ---------------------------------------------------------------------------

add(
  'organization_list',
  'List the organizations the authenticated account can access, including ids, names and plans. Use the organizationId in all other tools.',
  {},
  [],
  READ,
  (client) => client.get('/v1/organizations', { sort: 'name', order: 'asc', page: 1, limit: 50 }),
);

add(
  'inbox_list',
  'List the support inboxes of an organization (email, WhatsApp, Messenger, Instagram, LinkedIn, Play Store).',
  { organizationId: ORG_ID },
  ['organizationId'],
  READ,
  (client, args) => client.get(`/v1/organizations/${str(args, 'organizationId')}/inboxes`, { page: 1, limit: 50 }),
);

add(
  'member_list',
  'List the members of an organization. Use member ids to assign conversations.',
  { organizationId: ORG_ID },
  ['organizationId'],
  READ,
  (client, args) => client.get(`/v1/organizations/${str(args, 'organizationId')}/members`, { page: 1, limit: 50 }),
);

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

add(
  'conversation_list',
  'List customer support conversations of an organization, newest first. Filter by status, inbox, assigned member or priority.',
  {
    organizationId: ORG_ID,
    status: { type: 'string', description: 'Filter by status.', enum: ['unread', 'read', 'open', 'closed'] },
    inboxId: STR('Filter by inbox id.'),
    assignedMemberId: STR('Filter by assigned organization member id.'),
    priority: NUM('Filter by priority (higher = more urgent).'),
    search: STR('Full text search over subject and messages.'),
    page: NUM('Page number, starting at 1.'),
    limit: NUM('Maximum conversations to return (default 10, max 50).'),
  },
  ['organizationId'],
  READ,
  (client, args) =>
    client.post(`/v1/organizations/${str(args, 'organizationId')}/conversations/search`, {
      sort: 'lastUpdate',
      order: 'desc',
      page: page(args),
      limit: limit(args),
      status: optStr(args, 'status'),
      inboxIds: optStr(args, 'inboxId') ? [optStr(args, 'inboxId')] : undefined,
      memberIds: optStr(args, 'assignedMemberId') ? [optStr(args, 'assignedMemberId')] : undefined,
      priority: optNum(args, 'priority') ?? -1,
      search: optStr(args, 'search'),
    }),
);

add(
  'conversation_get',
  'Get a customer conversation by id (subject, status, priority, classification, assignment, contact).',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  ['organizationId', 'conversationId'],
  READ,
  (client, args) =>
    client.get(`/v1/organizations/${str(args, 'organizationId')}/conversations/${str(args, 'conversationId')}`),
);

add(
  'conversation_messages',
  'List the messages of a conversation, newest first.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    page: NUM('Page number, starting at 1.'),
    limit: NUM('Maximum messages to return (default 10, max 50).'),
  },
  ['organizationId', 'conversationId'],
  READ,
  (client, args) =>
    client.post(`/v1/organizations/${str(args, 'organizationId')}/messages/search`, {
      conversationId: str(args, 'conversationId'),
      sort: 'created',
      order: 'desc',
      page: page(args),
      limit: limit(args),
    }),
);

add(
  'conversation_reply',
  'Send a reply to the customer in a conversation. The reply is delivered through the conversation\'s inbox (email, WhatsApp, ...). This is irreversible — only call it with a reply text the user has approved.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    message: STR('The plain text reply to send to the customer.'),
  },
  ['organizationId', 'conversationId', 'message'],
  DESTRUCTIVE,
  async (client, args) => {
    const organizationId = str(args, 'organizationId');
    const conversation = (await client.get(
      `/v1/organizations/${organizationId}/conversations/${str(args, 'conversationId')}`,
    )) as { lastMessageId?: string };
    if (!conversation.lastMessageId) {
      throw new Error('Conversation has no message to reply to.');
    }
    return client.post(`/v1/organizations/${organizationId}/messages/${conversation.lastMessageId}/reply`, {
      messagePlain: str(args, 'message'),
    });
  },
);

add(
  'conversation_close',
  'Close a customer conversation.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  ['organizationId', 'conversationId'],
  WRITE,
  async (client, args) => {
    await client.put(
      `/v1/organizations/${str(args, 'organizationId')}/conversations/${str(args, 'conversationId')}/close`,
    );
    return { success: true, message: 'Conversation closed.' };
  },
);

add(
  'conversation_update',
  'Update a customer conversation: assign it to a member, change priority, status or classification. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    assignedMemberId: STR('Organization member id to assign the conversation to (see member_list).'),
    priority: NUM('New priority (higher = more urgent).'),
    status: NUM('New status: 0 = unread, 1 = read, 2 = closed.'),
    classificationId: STR('New classification id.'),
  },
  ['organizationId', 'conversationId'],
  WRITE,
  (client, args) =>
    client.put(
      `/v1/organizations/${str(args, 'organizationId')}/conversations/${str(args, 'conversationId')}`,
      {
        assignedMemberId: optStr(args, 'assignedMemberId'),
        priority: optNum(args, 'priority'),
        status: optNum(args, 'status'),
        classificationId: optStr(args, 'classificationId'),
      },
    ),
);

add(
  'conversation_stats',
  'Conversation statistics of an organization for a date range (volumes, response metrics).',
  {
    organizationId: ORG_ID,
    startDate: STR('Start date (YYYY-MM-DD).'),
    endDate: STR('End date (YYYY-MM-DD).'),
  },
  ['organizationId'],
  READ,
  (client, args) =>
    client.post(`/v1/organizations/${str(args, 'organizationId')}/conversations/statistic`, {
      startDate: optStr(args, 'startDate'),
      endDate: optStr(args, 'endDate'),
    }),
);

add(
  'conversation_totals',
  'Current conversation totals of an organization (e.g. open and unread counts).',
  { organizationId: ORG_ID },
  ['organizationId'],
  READ,
  (client, args) => client.get(`/v1/organizations/${str(args, 'organizationId')}/conversations/totals`),
);

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

add(
  'ai_draft_reply',
  'Generate an AI reply draft for a conversation using the organization\'s configured prompts and knowledge base. Returns the draft without sending it.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  ['organizationId', 'conversationId'],
  READ,
  (client, args) =>
    client.get(
      `/v1/organizations/${str(args, 'organizationId')}/ai/complete/${str(args, 'conversationId')}`,
    ),
);

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = definitions;

export async function dispatchTool(
  client: FirstReplyClient,
  name: string,
  args: ToolArgs,
): Promise<unknown | null> {
  const handler = handlers.get(name);
  if (!handler) return null;
  return handler(client, args);
}
