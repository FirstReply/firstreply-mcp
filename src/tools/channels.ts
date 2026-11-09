/**
 * Channels: the channels customers write to.
 */

import { add, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const CHANNEL_ID = str('The channel id (see channel_list).');

add(
  'channel_list',
  'List the support channels of an organization: email, WhatsApp, Messenger, Instagram, LinkedIn, Google Play, App Store and website chat, with their type, name and health. publishingEnabled marks the social accounts posts can be published to (see post_schedule).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/channels'), { page: 1, limit: 50 }),
);

add(
  'channel_get',
  'Get one channel by id: type, name, connected account or mail server, signature, health and activation state.',
  { organizationId: ORG_ID, channelId: CHANNEL_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, `/channels/${args.channelId}`)),
);

add(
  'channel_statistics',
  'Statistics per channel of an organization (conversation volumes).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/channels/statistics')),
);

add(
  'channel_refresh',
  'Fetch new messages from a channel now instead of waiting for the next scheduled retrieval.',
  { organizationId: ORG_ID, channelId: CHANNEL_ID },
  WRITE,
  async (client, args) => {
    await client.post(orgPath(args.organizationId, `/channels/${args.channelId}/refresh`));
    return { success: true, message: 'Channel refresh started.' };
  },
);

add(
  'channel_test',
  'Test the connection of a channel to its platform (mail server, Meta, Google, Apple, ...) and report the result.',
  { organizationId: ORG_ID, channelId: CHANNEL_ID },
  { ...READ, openWorldHint: true },
  (client, args) => client.post(orgPath(args.organizationId, `/channels/${args.channelId}/test`)),
);
