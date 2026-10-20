/**
 * Single messages: reading, editing drafts, sending drafts, deleting.
 */

import { add, DESTRUCTIVE, optStr, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const MESSAGE_ID = str('The message id (see conversation_messages or conversation_thread).');

const messagePath = (organizationId: string, messageId: string, suffix = ''): string =>
  orgPath(organizationId, `/messages/${messageId}${suffix}`);

/** Minimal HTML body for a plain text, so the stored HTML and plain text of a draft stay in sync. */
function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

add(
  'message_get',
  'Get one message by id: sender, recipients, subject, plain text, detected language, translation, attachments and the draft / internal note flags.',
  { organizationId: ORG_ID, messageId: MESSAGE_ID },
  READ,
  (client, args) => client.get(messagePath(args.organizationId, args.messageId)),
);

add(
  'message_update',
  'Edit a draft or an internal note before it is sent: replace its text, subject, language or translation. Only provide fields to change. Sent messages cannot be edited.',
  {
    organizationId: ORG_ID,
    messageId: MESSAGE_ID,
    message: optStr('New plain text body.'),
    subject: optStr('New subject.'),
    language: optStr('Two-letter language code of the text.'),
    translation: optStr('The text as the agent wrote it, when message is a translation of it.'),
  },
  WRITE,
  async (client, args) => {
    const path = messagePath(args.organizationId, args.messageId);
    const current = (await client.get(path)) as { draft?: boolean; internal?: boolean };
    if (!current.draft && !current.internal) {
      throw new Error('Only drafts and internal notes can be edited.');
    }
    return client.put(path, {
      subject: args.subject,
      messagePlain: args.message,
      messageHtml: args.message === undefined ? undefined : textToHtml(args.message),
      language: args.language,
      translation: args.translation,
    });
  },
);

add(
  'message_send',
  'Send a draft message to the customer through the conversation\'s inbox. Irreversible: only call it after the user approved the draft (read it with message_get first).',
  { organizationId: ORG_ID, messageId: MESSAGE_ID },
  DESTRUCTIVE,
  (client, args) => client.post(messagePath(args.organizationId, args.messageId, '/send')),
);

add(
  'message_delete',
  'Delete a message permanently, e.g. a draft or an internal note.',
  { organizationId: ORG_ID, messageId: MESSAGE_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(messagePath(args.organizationId, args.messageId));
    return { success: true, message: 'Message deleted.' };
  },
);
