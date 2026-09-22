/**
 * Organizations, members and API keys.
 */

import { add, DESTRUCTIVE, num, optNum, optStr, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

add(
  'organization_list',
  'List the organizations the authenticated account can access, including ids, names and plans. Use the organizationId in all other tools.',
  {},
  READ,
  (client) => client.get('/v1/organizations', { sort: 'name', order: 'asc', page: 1, limit: 50 }),
);

add(
  'organization_get',
  'Get an organization: name, default language, description, plan, auto-close setting and the custom AI prompts (persona, reply instructions, classification instructions).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId)),
);

add(
  'organization_update',
  'Update the settings of an organization. Only provide fields to change. Requires organization admin permission.',
  {
    organizationId: ORG_ID,
    name: optStr('New name of the organization.'),
    language: optStr(
      'Default language of the team (two-letter code, e.g. "en"). Incoming messages in other languages are translated into it.',
    ),
    description: optStr('Description of the organization.'),
    autoCloseInactivityDays: optNum('Close conversations automatically after this many days without activity; 0 disables it.'),
    aiPromptEgo: optStr(
      'Custom AI persona prompt (role, tone, capabilities) that replaces the built-in one for AI replies. Empty restores the default.',
    ),
    aiPromptConfig: optStr('Custom response rules for AI replies (formatting, what to avoid). Empty restores the default.'),
    aiPromptClassification: optStr(
      'Custom instructions for classifying incoming messages. Empty restores the default.',
    ),
  },
  WRITE,
  (client, { organizationId, ...fields }) => client.put(orgPath(organizationId), fields),
);

add(
  'organization_usage',
  'Plan and usage of an organization: plan name, trial / active / cancelled state, inbox and member counts against the plan limits.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/usage')),
);

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const PERMISSION =
  'Permission level: 1 = member (sees assigned conversations), 2 = manager, 3 = admin (settings, API keys), 4 = owner.';

add(
  'member_list',
  'List the members of an organization with their profile and permission level. Use member ids to assign conversations.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/members'), { page: 1, limit: 50 }),
);

add(
  'member_get',
  'Get one organization member by id.',
  { organizationId: ORG_ID, memberId: str('The organization member id (see member_list).') },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, `/members/${args.memberId}`)),
);

add(
  'member_create',
  'Add a member to an organization by email address. Requires organization admin permission.',
  {
    organizationId: ORG_ID,
    email: str('Email address of the person to add.'),
    permission: num(PERMISSION),
  },
  WRITE,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/members'), { email: args.email, permission: args.permission }),
);

add(
  'member_update',
  'Change the permission level of an organization member. Requires organization admin permission.',
  {
    organizationId: ORG_ID,
    memberId: str('The organization member id (see member_list).'),
    permission: num(PERMISSION),
  },
  WRITE,
  async (client, args) => {
    const path = orgPath(args.organizationId, `/members/${args.memberId}`);
    // The update DTO carries primitive flags that would otherwise reset, so send the current values along.
    const current = (await client.get(path)) as { activated: boolean; deleted: boolean };
    return client.put(path, { permission: args.permission, activated: current.activated, deleted: current.deleted });
  },
);

add(
  'member_delete',
  'Remove a member from an organization. Their assigned conversations stay in the organization. Requires organization admin permission.',
  { organizationId: ORG_ID, memberId: str('The organization member id to remove.') },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(orgPath(args.organizationId, `/members/${args.memberId}`));
    return { success: true, message: 'Member removed.' };
  },
);

// ---------------------------------------------------------------------------
// API keys (organization admins only)
// ---------------------------------------------------------------------------

add(
  'api_key_list',
  'List the named API keys of an organization (name, masked prefix, created, last used, expiry). Never returns the key values. Requires organization admin permission.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/apiKeys'), { page: 1, limit: 50 }),
);

add(
  'api_key_create',
  'Create a new named API key for an organization. The response contains the plaintext key exactly once: relay it to the user immediately and treat it as a secret; it cannot be retrieved later. Requires organization admin permission.',
  {
    organizationId: ORG_ID,
    name: str('A descriptive name for the key, e.g. the integration that will use it.'),
    expirationDays: optNum('Days until the key expires. Omit or 0 for a key that never expires.'),
  },
  WRITE,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/apiKeys'), {
      name: args.name,
      expirationDays: args.expirationDays ?? 0,
    }),
);

add(
  'api_key_delete',
  'Delete (revoke) an API key of an organization. Integrations using the key stop working immediately, including this MCP server if the key it authenticates with is deleted. Requires organization admin permission.',
  {
    organizationId: ORG_ID,
    apiKeyId: str('The id of the API key to delete (see api_key_list).'),
  },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(orgPath(args.organizationId, `/apiKeys/${args.apiKeyId}`));
    return { success: true, message: 'API key deleted.' };
  },
);
