/**
 * Single messages: reading, editing drafts, sending drafts, deleting.
 */

import { openRemoteFile } from '../media.js';
import { add, DESTRUCTIVE, optStr, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const MESSAGE_ID = str('The message id (see conversation_messages or conversation_thread).');
/** The API's limit for one attachment. */
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

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
  'Send a draft message to the customer through the conversation\'s channel. Irreversible: only call it after the user approved the draft (read it with message_get first).',
  { organizationId: ORG_ID, messageId: MESSAGE_ID },
  DESTRUCTIVE,
  (client, args) => client.post(messagePath(args.organizationId, args.messageId, '/send')),
);

add(
  'attachment_upload',
  'Upload a file from a public https address as an attachment for a reply (JPEG, PNG, GIF or WebP image, PDF, plain text, CSV, Word or Excel document, up to 50 MB; the address has to report the file size). Returns the attachment (name, size, mime, file): pass it unchanged in attachments to conversation_reply.',
  {
    organizationId: ORG_ID,
    url: str('Public https:// address of the file. Private or local addresses are refused.'),
    fileName: optStr('File name the customer sees. Default: the last part of the address.'),
    contentType: optStr('MIME type, e.g. application/pdf. Default: what the address reports.'),
  },
  { ...WRITE, openWorldHint: true },
  async (client, args) => {
    const file = await openRemoteFile(args.url);
    try {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error('The file is larger than 50 MB.');
      }
      const contentType = args.contentType ?? file.contentType;
      if (!contentType) {
        throw new Error('The address does not report the type of the file: pass contentType.');
      }
      return await client.postFile(orgPath(args.organizationId, '/attachment'), {
        stream: file.stream,
        size: file.size,
        contentType,
        fileName: args.fileName ?? file.fileName,
      });
    } finally {
      file.stream.destroy();
    }
  },
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
