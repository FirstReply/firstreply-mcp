import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { TOOL_DEFINITIONS, dispatchTool } from '../src/tools.js';
import { FirstReplyClient } from '../src/client.js';

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/** A FirstReplyClient stand-in that records calls and answers from a "METHOD path" map. */
function fakeClient(responses: Record<string, unknown> = {}): { client: FirstReplyClient; calls: Call[] } {
  const calls: Call[] = [];
  const respond = (method: string, path: string, body?: unknown): Promise<unknown> => {
    calls.push({ method, path, body });
    return Promise.resolve(responses[`${method} ${path}`] ?? {});
  };
  const client = {
    get: (path: string, query?: unknown) => respond('GET', path, query),
    post: (path: string, body?: unknown) => respond('POST', path, body),
    put: (path: string, body?: unknown) => respond('PUT', path, body),
    delete: (path: string) => respond('DELETE', path),
  } as unknown as FirstReplyClient;
  return { client, calls };
}

function jsonSchema(tool: (typeof TOOL_DEFINITIONS)[number]): {
  properties: Record<string, { description?: string }>;
  required?: string[];
} {
  return z.toJSONSchema(z.object(tool.inputSchema)) as ReturnType<typeof jsonSchema>;
}

test('tool names are unique, snake_case and resource_action shaped', () => {
  const names = TOOL_DEFINITIONS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length, 'duplicate tool names');
  for (const name of names) {
    assert.match(name, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `invalid tool name: ${name}`);
  }
  assert.ok(names.length >= 80, `expected the full tool set, got ${names.length}`);
});

test('every tool has description, title, annotations and documented arguments', () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.ok(tool.description.length > 20, `${tool.name}: description too short`);
    assert.ok(tool.title.length > 0);
    assert.equal(typeof tool.annotations.readOnlyHint, 'boolean');
    assert.equal(typeof tool.annotations.destructiveHint, 'boolean');
    for (const [property, schema] of Object.entries(jsonSchema(tool).properties)) {
      assert.ok(schema.description, `${tool.name}.${property}: missing description`);
    }
  }
});

test('org-scoped tools require organizationId', () => {
  for (const tool of TOOL_DEFINITIONS) {
    const schema = jsonSchema(tool);
    if (schema.properties.organizationId) {
      assert.ok((schema.required ?? []).includes('organizationId'), `${tool.name}: organizationId must be required`);
    }
  }
});

test('annotations follow the tool name', () => {
  for (const tool of TOOL_DEFINITIONS) {
    if (/_(list|get|search|statistics|totals|status|impact|usage|thread|messages)$/.test(tool.name) || tool.name === 'search') {
      assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} should be read-only`);
    }
    if (/_delete$/.test(tool.name) || ['conversation_reply', 'message_send'].includes(tool.name)) {
      assert.equal(tool.annotations.destructiveHint, true, `${tool.name} should be destructive`);
      assert.equal(tool.annotations.readOnlyHint, false);
    }
  }
});

test('dispatchTool returns null for unknown tools', async () => {
  const { client } = fakeClient();
  assert.equal(await dispatchTool(client, 'does_not_exist', {}), null);
});

test('missing required argument produces a helpful error', async () => {
  const { client } = fakeClient();
  await assert.rejects(dispatchTool(client, 'inbox_list', {}), /Missing required argument: organizationId/);
});

test('conversation_list maps its filters onto the search request', async () => {
  const { client, calls } = fakeClient();
  await dispatchTool(client, 'conversation_list', {
    organizationId: 'org',
    status: 'open',
    inboxId: 'inbox-1',
    createdAfter: '2026-09-01',
    search: 'invoice is:unassigned',
    limit: 5,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/v1/organizations/org/conversations/search');
  assert.deepEqual(calls[0].body, {
    page: 1,
    limit: 5,
    status: 'open',
    inboxIds: ['inbox-1'],
    memberIds: undefined,
    classificationIds: undefined,
    contactId: undefined,
    language: undefined,
    spam: undefined,
    priority: -1,
    search: 'invoice is:unassigned',
    createdFrom: Date.parse('2026-09-01'),
    createdTo: undefined,
    lastUpdateFrom: undefined,
    lastUpdateTo: undefined,
  });
});

test('conversation_list rejects an unparseable date', async () => {
  const { client } = fakeClient();
  await assert.rejects(
    dispatchTool(client, 'conversation_list', { organizationId: 'org', createdAfter: 'yesterday' }),
    /Invalid date "yesterday"/,
  );
});

test('conversation_reply answers the last message and passes note, draft and translation fields', async () => {
  const { client, calls } = fakeClient({
    'GET /v1/organizations/org/conversations/c1': { lastMessageId: 'm9' },
  });
  await dispatchTool(client, 'conversation_reply', {
    organizationId: 'org',
    conversationId: 'c1',
    message: 'Hola',
    language: 'es',
    translation: 'Hello',
  });
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].path, '/v1/organizations/org/messages/m9/reply');
  assert.deepEqual(calls[1].body, {
    messagePlain: 'Hola',
    internal: undefined,
    draft: undefined,
    language: 'es',
    translation: 'Hello',
  });

  await assert.rejects(
    dispatchTool(client, 'conversation_reply', {
      organizationId: 'org',
      conversationId: 'c1',
      message: 'x',
      internal: true,
      draft: true,
    }),
    /internal and draft cannot both be true/,
  );
});

test('classification_update keeps the settings it was not asked to change', async () => {
  const { client, calls } = fakeClient({
    'GET /v1/organizations/org/classifications/cl1': {
      name: 'Billing',
      description: 'Invoices',
      color: 3,
      aiReply: true,
      aiReplyDraft: false,
      sentimentAnalysis: true,
      autoClose: false,
      defaultMemberId: 'mem-1',
      promptId: 'p1',
      templateId: 't1',
    },
  });
  await dispatchTool(client, 'classification_update', {
    organizationId: 'org',
    classificationId: 'cl1',
    name: 'Billing & payments',
    autoClose: true,
  });
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(calls[1].body, {
    name: 'Billing & payments',
    description: 'Invoices',
    color: 3,
    aiReply: true,
    aiReplyDraft: false,
    sentimentAnalysis: true,
    autoClose: true,
    defaultMemberId: 'mem-1',
    promptId: 'p1',
    templateId: 't1',
  });
});

test('filter_update merges criteria into the saved filter', async () => {
  const { client, calls } = fakeClient({
    'GET /v1/organizations/org/filters/f1': {
      name: 'Urgent',
      color: 2,
      arrangement: 4,
      filter: { status: 'open', priority: 2, inboxIds: ['i1'] },
    },
  });
  await dispatchTool(client, 'filter_update', { organizationId: 'org', filterId: 'f1', status: 'unread' });
  assert.deepEqual(calls[1].body, {
    name: 'Urgent',
    color: 2,
    arrangement: 4,
    filter: { status: 'unread', priority: 2, inboxIds: ['i1'] },
  });
});

test('message_update only edits drafts and notes, and keeps HTML and text in sync', async () => {
  const { client, calls } = fakeClient({
    'GET /v1/organizations/org/messages/d1': { draft: true, outgoing: true, positive: true, opened: 0 },
    'GET /v1/organizations/org/messages/s1': { draft: false, internal: false, outgoing: true, positive: true, opened: 1 },
  });
  await dispatchTool(client, 'message_update', {
    organizationId: 'org',
    messageId: 'd1',
    message: 'Hi <you>\n\nThanks & bye',
  });
  assert.deepEqual(calls[1].body, {
    outgoing: true,
    positive: true,
    opened: 0,
    subject: undefined,
    messagePlain: 'Hi <you>\n\nThanks & bye',
    messageHtml: '<p>Hi &lt;you&gt;</p><p>Thanks &amp; bye</p>',
    language: undefined,
    translation: undefined,
  });

  await assert.rejects(
    dispatchTool(client, 'message_update', { organizationId: 'org', messageId: 's1', message: 'x' }),
    /Only drafts and internal notes can be edited/,
  );
});

test('knowledge source tools never return the configuration', async () => {
  const { client } = fakeClient({
    'GET /v1/organizations/org/knowledge-sources': {
      items: [{ id: 's1', name: 'Docs', configuration: '{"token":"secret"}' }],
      count: 1,
    },
  });
  const result = await dispatchTool(client, 'knowledge_source_list', { organizationId: 'org' });
  assert.deepEqual(result, { items: [{ id: 's1', name: 'Docs' }], count: 1 });
});
