/**
 * Conversations: listing, reading, replying, triage and statistics.
 */

import {
  add,
  CONVERSATION_ID,
  DESTRUCTIVE,
  epochMillis,
  idList,
  LIMIT,
  optBool,
  optDate,
  optEnum,
  optNum,
  optStr,
  ORG_ID,
  orgPath,
  PAGE,
  paging,
  READ,
  str,
  WRITE,
} from './registry.js';

export const SEARCH_SYNTAX =
  'Words are AND-ed and prefix matched. Use "quoted phrases", -word to exclude, and the operators from:<sender name or email>, subject:<text>, is:<open|closed|unread|read|assigned|unassigned|ai>, has:<attachment|draft>, before:<YYYY-MM-DD>, after:<YYYY-MM-DD>.';

const STATUS_VALUES = ['unread', 'read', 'open', 'closed'] as const;

const conversationPath = (organizationId: string, conversationId: string, suffix = ''): string =>
  orgPath(organizationId, `/conversations/${conversationId}${suffix}`);

add(
  'conversation_list',
  'List customer conversations of an organization, highest priority and most recent activity first (by relevance when searching). All filters are optional and combine. Each result carries the subject, status, priority, classification, assignee, contact, language and the last message.',
  {
    organizationId: ORG_ID,
    status: optEnum(STATUS_VALUES, 'Filter by status; "open" is unread + read.'),
    inboxId: optStr('Filter by inbox id.'),
    assignedMemberId: optStr('Filter by assigned organization member id.'),
    contactId: optStr('Filter by contact id: the conversations of one customer.'),
    classificationId: optStr('Filter by classification id.'),
    language: optStr('Filter by the customer\'s language (two-letter code).'),
    spam: optBool('true lists only conversations marked as spam, false only the others. Omit for the default listing.'),
    priority: optNum('Filter by exact priority (higher = more urgent).'),
    search: optStr(`Full text search over subject, messages and contact. ${SEARCH_SYNTAX}`),
    createdAfter: optDate('Only conversations created at or after this time.'),
    createdBefore: optDate('Only conversations created at or before this time.'),
    updatedAfter: optDate('Only conversations updated at or after this time.'),
    updatedBefore: optDate('Only conversations updated at or before this time.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/conversations/search'), {
      ...paging(args),
      status: args.status,
      inboxIds: idList(args.inboxId),
      memberIds: idList(args.assignedMemberId),
      classificationIds: idList(args.classificationId),
      contactId: args.contactId,
      language: args.language,
      spam: args.spam,
      priority: args.priority ?? -1,
      search: args.search,
      createdFrom: epochMillis(args.createdAfter),
      createdTo: epochMillis(args.createdBefore),
      lastUpdateFrom: epochMillis(args.updatedAfter),
      lastUpdateTo: epochMillis(args.updatedBefore),
    }),
);

add(
  'conversation_get',
  'Get a customer conversation by id: subject, status, priority, classification (with the AI\'s reason and confidence), assignment, contact, language and last message.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  READ,
  (client, args) => client.get(conversationPath(args.organizationId, args.conversationId)),
);

add(
  'conversation_thread',
  'Get a conversation together with all of its messages in one call. Prefer this over conversation_get + conversation_messages when the full history is needed.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    markRead: optBool('Also mark the conversation as read (default false).'),
  },
  READ,
  (client, args) =>
    client.get(conversationPath(args.organizationId, args.conversationId, '/thread'), {
      markRead: args.markRead ? 'true' : undefined,
    }),
);

add(
  'conversation_messages',
  'List the messages of a conversation, newest first. Each message carries sender, recipients, plain text, detected language, a translation into the team\'s language when they differ, and draft / internal note flags.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    search: optStr('Only messages matching this text.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/messages/search'), {
      conversationId: args.conversationId,
      search: args.search,
      sort: 'created',
      order: 'desc',
      ...paging(args),
    }),
);

add(
  'conversation_reply',
  'Send a reply to the customer in a conversation, delivered through the conversation\'s inbox (email, WhatsApp, ...). Sending is irreversible: only call it with a text the user has approved. Set internal=true to add an internal note visible to the team only, or draft=true to store a draft the team can review and send with message_send.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    message: str('The plain text of the reply, note or draft.'),
    internal: optBool('true stores the text as an internal note instead of sending it.'),
    draft: optBool('true stores the text as a draft instead of sending it.'),
    language: optStr(
      'Two-letter code of the language of message when it was translated for the customer (see ai_translate). Send together with translation.',
    ),
    translation: optStr('The text as the agent wrote it, when message is a translation of it. Kept alongside the sent text.'),
  },
  DESTRUCTIVE,
  async (client, args) => {
    if (args.internal && args.draft) {
      throw new Error('internal and draft cannot both be true.');
    }
    const conversation = (await client.get(conversationPath(args.organizationId, args.conversationId))) as {
      lastMessageId?: string;
    };
    if (!conversation.lastMessageId) {
      throw new Error('Conversation has no message to reply to.');
    }
    return client.post(orgPath(args.organizationId, `/messages/${conversation.lastMessageId}/reply`), {
      messagePlain: args.message,
      internal: args.internal,
      draft: args.draft,
      language: args.language,
      translation: args.translation,
    });
  },
);

add(
  'conversation_close',
  'Close a customer conversation.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  WRITE,
  async (client, args) => {
    await client.put(conversationPath(args.organizationId, args.conversationId, '/close'));
    return { success: true, message: 'Conversation closed.' };
  },
);

add(
  'conversation_read',
  'Mark an unread conversation as read.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  WRITE,
  async (client, args) => {
    await client.put(conversationPath(args.organizationId, args.conversationId, '/read'));
    return { success: true, message: 'Conversation marked as read.' };
  },
);

add(
  'conversation_spam',
  'Mark a conversation as spam, or undo that with spam=false.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    spam: optBool('false marks the conversation as not spam (default true).'),
  },
  WRITE,
  async (client, args) => {
    const spam = args.spam !== false;
    await client.put(conversationPath(args.organizationId, args.conversationId, spam ? '/spam' : '/not-spam'));
    return { success: true, message: spam ? 'Conversation marked as spam.' : 'Conversation marked as not spam.' };
  },
);

add(
  'conversation_update',
  'Update a customer conversation: assign it to a member, change priority, status, classification, subject, language, contact or spam flag. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    conversationId: CONVERSATION_ID,
    assignedMemberId: optStr('Organization member id to assign the conversation to (see member_list).'),
    priority: optNum('New priority (higher = more urgent).'),
    status: optNum('New status: 0 = unread, 1 = read, 2 = closed.'),
    classificationId: optStr('New classification id (see classification_list).'),
    subject: optStr('New subject.'),
    language: optStr('Customer language (two-letter code) when the detected one is wrong.'),
    contactId: optStr('Move the conversation to another contact (see contact_list).'),
    spam: optBool('Spam flag.'),
  },
  WRITE,
  (client, { organizationId, conversationId, ...fields }) =>
    client.put(conversationPath(organizationId, conversationId), fields),
);

add(
  'conversation_delete',
  'Delete a conversation and all of its messages permanently.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(conversationPath(args.organizationId, args.conversationId));
    return { success: true, message: 'Conversation deleted.' };
  },
);

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

const START_DATE = optStr('Start date (YYYY-MM-DD).');
const END_DATE = optStr('End date (YYYY-MM-DD).');

add(
  'conversation_stats',
  'Daily counts of opened and closed conversations of an organization for a date range.',
  { organizationId: ORG_ID, startDate: START_DATE, endDate: END_DATE },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/conversations/statistic'), {
      startDate: args.startDate,
      endDate: args.endDate,
    }),
);

add(
  'conversation_stats_by_member',
  'Conversation statistics per organization member for a date range: who handled how many conversations.',
  { organizationId: ORG_ID, startDate: START_DATE, endDate: END_DATE },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/conversations/statistic/by-member'), {
      startDate: args.startDate,
      endDate: args.endDate,
    }),
);

add(
  'conversation_metrics',
  'Support metrics of an organization for a date range: totals and closing rate, first reply times (median, p90, average), AI reply share, sentiment share, closing rate over time, close reasons and closes per member.',
  { organizationId: ORG_ID, startDate: START_DATE, endDate: END_DATE },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/metrics/statistic'), {
      startDate: args.startDate,
      endDate: args.endDate,
    }),
);

add(
  'conversation_totals',
  'Current conversation totals of an organization (e.g. open and unread counts).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/conversations/totals')),
);
