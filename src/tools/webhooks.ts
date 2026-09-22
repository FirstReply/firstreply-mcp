/**
 * Webhooks: HTTP notifications about events in the organization.
 */

import { add, DESTRUCTIVE, LIMIT, optStr, ORG_ID, orgPath, PAGE, paging, READ, str, WRITE } from './registry.js';

const WEBHOOK_ID = str('The webhook id (see webhook_list).');

const EVENTS =
  'Event name, or several comma-separated: conversation.create, conversation.update, conversation.delete, conversation.reassign, message.create, message.update, message.delete, contact.create, contact.update, contact.delete, knowledge.create, knowledge.update, knowledge.delete, classification.create, classification.update, classification.delete, template.create, template.update, template.delete, prompt.create, prompt.update, prompt.delete, inbox.create, inbox.update, inbox.delete, member.add, member.remove, organization.update.';

const webhookPath = (organizationId: string, webhookId: string, suffix = ''): string =>
  orgPath(organizationId, `/webhooks/${webhookId}${suffix}`);

add(
  'webhook_list',
  'List the webhooks of an organization: target URL and subscribed events.',
  {
    organizationId: ORG_ID,
    event: optStr('Only webhooks subscribed to this event.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/webhooks/search'), { event: args.event, ...paging(args) }),
);

add(
  'webhook_get',
  'Get one webhook by id.',
  { organizationId: ORG_ID, webhookId: WEBHOOK_ID },
  READ,
  (client, args) => client.get(webhookPath(args.organizationId, args.webhookId)),
);

add(
  'webhook_create',
  'Create a webhook that POSTs the given events to a URL. Deliveries are signed with a secret: call webhook_rotate_secret to obtain one.',
  {
    organizationId: ORG_ID,
    target: str('HTTPS URL that receives the events.'),
    event: str(EVENTS),
  },
  WRITE,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/webhooks'), { target: args.target, event: args.event }),
);

add(
  'webhook_update',
  'Update the target URL or events of a webhook. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    webhookId: WEBHOOK_ID,
    target: optStr('New target URL.'),
    event: optStr(EVENTS),
  },
  WRITE,
  (client, { organizationId, webhookId, ...fields }) => client.put(webhookPath(organizationId, webhookId), fields),
);

add(
  'webhook_delete',
  'Delete a webhook. The target stops receiving events immediately.',
  { organizationId: ORG_ID, webhookId: WEBHOOK_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(webhookPath(args.organizationId, args.webhookId));
    return { success: true, message: 'Webhook deleted.' };
  },
);

add(
  'webhook_test',
  'Send a test event to a webhook and report the delivery result (status code, response).',
  { organizationId: ORG_ID, webhookId: WEBHOOK_ID },
  { ...WRITE, openWorldHint: true },
  (client, args) => client.post(webhookPath(args.organizationId, args.webhookId, '/test')),
);

add(
  'webhook_rotate_secret',
  'Generate a new signing secret for a webhook. The response contains the secret exactly once; the previous secret stops validating immediately.',
  { organizationId: ORG_ID, webhookId: WEBHOOK_ID },
  WRITE,
  (client, args) => client.post(webhookPath(args.organizationId, args.webhookId, '/rotate-secret')),
);
