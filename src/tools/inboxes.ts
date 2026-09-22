/**
 * Inboxes: the channels customers write to.
 */

import { add, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const INBOX_ID = str('The inbox id (see inbox_list).');

add(
  'inbox_list',
  'List the support inboxes of an organization: email, WhatsApp, Messenger, Instagram, LinkedIn, Google Play, App Store and website chat, with their type, name and health.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/inboxes'), { page: 1, limit: 50 }),
);

add(
  'inbox_get',
  'Get one inbox by id: type, name, connected account or mail server, signature, health and activation state.',
  { organizationId: ORG_ID, inboxId: INBOX_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, `/inboxes/${args.inboxId}`)),
);

add(
  'inbox_statistics',
  'Statistics per inbox of an organization (conversation volumes).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/inboxes/statistics')),
);

add(
  'inbox_refresh',
  'Fetch new messages from an inbox now instead of waiting for the next scheduled retrieval.',
  { organizationId: ORG_ID, inboxId: INBOX_ID },
  WRITE,
  async (client, args) => {
    await client.post(orgPath(args.organizationId, `/inboxes/${args.inboxId}/refresh`));
    return { success: true, message: 'Inbox refresh started.' };
  },
);

add(
  'inbox_test',
  'Test the connection of an inbox to its platform (mail server, Meta, Google, Apple, ...) and report the result.',
  { organizationId: ORG_ID, inboxId: INBOX_ID },
  { ...READ, openWorldHint: true },
  (client, args) => client.post(orgPath(args.organizationId, `/inboxes/${args.inboxId}/test`)),
);
