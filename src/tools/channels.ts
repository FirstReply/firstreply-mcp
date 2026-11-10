/**
 * Channels: the channels customers write to and posts are published to, and setting them up.
 *
 * There is deliberately no tool to delete a channel: that removes its conversations'
 * way back to the customer and is done by a person in FirstReply.
 */

import { z } from 'zod';
import { add, optBool, optEnum, optNum, optStr, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const CHANNEL_ID = str('The channel id (see channel_list).');

add(
  'channel_list',
  'List the channels of an organization: email, website chat, WhatsApp, Facebook Page (MESSENGER), Instagram, LinkedIn, Threads, X, TikTok, YouTube, Google Business Profile, Bluesky, Mastodon, Telegram, Google Play and App Store, with their type, name and health. publishingEnabled marks the social accounts posts can be published to (see post_schedule).',
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

// ---------------------------------------------------------------------------
// Setting channels up
// ---------------------------------------------------------------------------

/** Channel types that are connected by signing in on the platform (channel_connect). */
const OAUTH_PLATFORMS = [
  'MESSENGER',
  'INSTAGRAM',
  'LINKEDIN',
  'WHATSAPP',
  'THREADS',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'GOOGLE_BUSINESS',
  'MASTODON',
] as const;

/** Channel types that are created from settings and credentials (channel_create). */
const CREDENTIAL_TYPES = ['EMAIL', 'WEBCHAT', 'BLUESKY', 'TELEGRAM', 'APPSTORE', 'PLAYSTORE'] as const;

/** What both a new and an existing channel take. Only the fields of the channel's type are used. */
const CHANNEL_SETTINGS = {
  publishingEnabled: optBool(
    'Social accounts: let posts be published to this channel (post_schedule). Counts against the plan\'s publishing limit; the channel has to be allowed to publish (publishingAuthorized, see channel_connect).',
  ),
  commentMode: optEnum(
    ['ALL', 'QUESTIONS', 'NONE'],
    'Social accounts: which comments on posts become conversations. ALL, QUESTIONS (emoji-only and off-topic comments are closed quietly) or NONE.',
  ),
  commentAutoReply: optBool('Social accounts: send AI replies to comments right away instead of keeping them as drafts.'),
  emailHost: optStr('EMAIL: mail server host name, e.g. mail.example.com.'),
  emailPort: optNum('EMAIL: SMTP port, e.g. 465 or 587.'),
  emailPortImap: optNum('EMAIL: IMAP port, e.g. 993.'),
  emailUsername: optStr('EMAIL: the mailbox address, which is also the login.'),
  emailPassword: optStr('EMAIL: the mailbox password. Stored encrypted, never returned.'),
  emailSsl: optBool('EMAIL: connect with SSL/TLS.'),
  webchatTitle: optStr('WEBCHAT: title shown in the widget.'),
  webchatWelcomeMessage: optStr('WEBCHAT: first message visitors see.'),
  webchatColor: optStr('WEBCHAT: accent color as hex, e.g. #2563eb.'),
  webchatTheme: optEnum(['auto', 'light', 'dark'], 'WEBCHAT: widget theme.'),
  webchatPosition: optEnum(['right', 'left'], 'WEBCHAT: side of the page the launcher sits on.'),
  webchatLauncherLabel: optStr('WEBCHAT: text next to the launcher button.'),
  webchatRequireContact: optBool('WEBCHAT: ask visitors for name and email before they can write.'),
  webchatAllowedDomains: optStr('WEBCHAT: comma-separated domains the widget may be embedded on. Empty allows every site.'),
  blueskyAppPassword: optStr(
    'BLUESKY: an app password (Bluesky settings, Privacy and security, App passwords), never the account password. Stored encrypted.',
  ),
  telegramBotToken: optStr('TELEGRAM: the token of the bot from @BotFather. Stored encrypted.'),
  telegramChat: optStr(
    'TELEGRAM: the Telegram channel the bot posts to (@name, a t.me link or the id); the bot has to be an administrator of it. Optional: without it the channel only receives messages to the bot.',
  ),
  appstoreAppId: optStr('APPSTORE: the app\'s Apple ID (the number in its App Store link).'),
  appstoreAppName: optStr('APPSTORE: the app\'s name.'),
  appstoreIssuerId: optStr('APPSTORE: issuer id of the App Store Connect API key.'),
  appstoreKeyId: optStr('APPSTORE: key id of the App Store Connect API key.'),
  appstorePrivateKey: optStr('APPSTORE: content of the .p8 private key file. Stored encrypted.'),
  playstorePackageName: optStr(
    'PLAYSTORE: the app\'s package name, e.g. com.example.app. The organization\'s service account (channel_playstore_service_account) has to be invited in the Play Console first.',
  ),
  playstoreApplicationName: optStr('PLAYSTORE: the app\'s name.'),
};

/** The given settings without the ones left out. */
function given(args: Record<string, unknown>, skip: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([key, value]) => value !== undefined && !skip.includes(key)));
}

add(
  'channel_create',
  `Create a channel that is set up with settings or credentials: ${CREDENTIAL_TYPES.join(', ')} (website chat needs none; the result carries the webchatKey of its embed snippet). Pass the fields of that type. Accounts that are connected by signing in (${OAUTH_PLATFORMS.join(', ')}) are started with channel_connect instead. FirstReply checks the credentials with the platform before it saves. Needs manager rights and a free channel in the plan (organization_usage).`,
  {
    organizationId: ORG_ID,
    type: z.enum(CREDENTIAL_TYPES).describe('The channel type.'),
    name: str('Name of the channel as the team sees it.'),
    blueskyHandle: optStr('BLUESKY: the account\'s handle, e.g. example.bsky.social.'),
    ...CHANNEL_SETTINGS,
  },
  { ...WRITE, openWorldHint: true },
  (client, args) => client.post(orgPath(args.organizationId, '/channels'), given(args, ['organizationId'])),
);

add(
  'channel_connect',
  `Start connecting an account that is connected by signing in on the platform: ${OAUTH_PLATFORMS.join(', ')} (MESSENGER is a Facebook Page). Returns a link (authUrl): the user opens it in a browser where they are signed in to FirstReply as the organization's owner, signs in on the platform, and FirstReply creates the channel; when the login can connect several accounts (Pages, locations, ...) FirstReply asks which one. The link is valid for 10 minutes. With channelId it reconnects that channel instead: after an expired or revoked login, or to grant more capabilities. Facebook Pages grant one capability per login, so ask for one at a time (first connect, then once more with channelId for PUBLISHING). Afterwards check channel_get: publishingAuthorized tells whether posts are allowed, channel_update turns publishingEnabled on.`,
  {
    organizationId: ORG_ID,
    platform: z.enum(OAUTH_PLATFORMS).describe('The platform of a new channel. Not needed with channelId.').optional(),
    name: optStr('Name of the new channel as the team sees it. Required without channelId.'),
    channelId: optStr('An existing channel to reconnect instead of creating one.'),
    capabilities: z
      .array(z.enum(['MESSAGING', 'PUBLISHING', 'COMMENTS', 'INSIGHTS']))
      .describe(
        'What the login asks for on Facebook, Instagram and TikTok (TikTok: COMMENTS on a reconnect adds the comments login). Default MESSAGING. Other platforms have one login for everything.',
      )
      .optional(),
    server: optStr('MASTODON: the server the account is on, e.g. mastodon.social.'),
  },
  { ...WRITE, openWorldHint: true },
  async (client, args) => {
    let response: { authUrl?: string };
    if (args.channelId) {
      response = (await client.post(orgPath(args.organizationId, `/channels/${args.channelId}/oauth/reconnect`), {
        capabilities: args.capabilities,
      })) as typeof response;
    } else {
      if (!args.platform || !args.name) {
        throw new Error('A new channel needs platform and name.');
      }
      response = (await client.post(orgPath(args.organizationId, '/channels/oauth/init'), {
        platform: args.platform,
        channelName: args.name,
        capabilities: args.capabilities,
        server: args.server,
      })) as typeof response;
    }
    // The state stays out of the result: the link carries it, nothing else needs it.
    return {
      authUrl: response.authUrl,
      next: 'Give the user this link. They open it in a browser where they are signed in to FirstReply and finish the login there (valid for 10 minutes). Then look the channel up with channel_list.',
    };
  },
);

add(
  'channel_update',
  'Change a channel: its name, whether it is active, publishing and comment handling of a social account, or the settings and credentials of its type. Only what is given changes. Turning publishingEnabled on makes the channel a target for post_schedule. A new login of a connected account is channel_connect with the channelId.',
  {
    organizationId: ORG_ID,
    channelId: CHANNEL_ID,
    name: optStr('New name of the channel.'),
    activated: optBool('false pauses the channel: nothing is fetched or sent.'),
    emailSignature: optStr('EMAIL: signature added to replies (HTML).'),
    ...CHANNEL_SETTINGS,
  },
  { ...WRITE, openWorldHint: true },
  async (client, args) => {
    const path = orgPath(args.organizationId, `/channels/${args.channelId}`);
    // The API finds the channel's contact from the whole channel (type, address, account),
    // so the stored channel is sent back with the changes, as the web app's form does.
    const channel = (await client.get(path)) as Record<string, unknown>;
    return client.put(path, { ...channel, ...given(args, ['organizationId', 'channelId']) });
  },
);

add(
  'channel_playstore_service_account',
  'The Google service account of the organization for Google Play reviews (created on the first call). The user invites its email in the Play Console (Users and permissions, with the permission to reply to reviews) before channel_create with type PLAYSTORE works.',
  { organizationId: ORG_ID },
  { ...WRITE, idempotentHint: true },
  (client, args) => client.post(orgPath(args.organizationId, '/channels/playstore/service-account')),
);

add(
  'channel_tiktok_creator_info',
  'What a TikTok channel may post right now, read from TikTok: the privacy levels the account offers, whether comments, duets and stitches can be allowed and the longest video. A TikTok target of post_schedule needs a privacyLevel from this list.',
  { organizationId: ORG_ID, channelId: CHANNEL_ID },
  { ...READ, openWorldHint: true },
  (client, args) => client.get(orgPath(args.organizationId, `/channels/${args.channelId}/tiktok/creator-info`)),
);
