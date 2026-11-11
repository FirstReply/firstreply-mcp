import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authChallenge, jwtExpiry, wwwAuthenticate } from '../src/auth.js';
import { TOOL_DEFINITIONS } from '../src/tools.js';
import { TOOL_WIDGETS, toolWidgetMeta, WIDGET_NAMES, widgetData } from '../src/widgets.js';

const jwt = (payload: unknown): string =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

test('every widget link names an existing tool and widget', () => {
  const tools = new Set(TOOL_DEFINITIONS.map((tool) => tool.name));
  for (const [tool, link] of Object.entries(TOOL_WIDGETS)) {
    assert.ok(tools.has(tool), `${tool} is a tool`);
    assert.ok(WIDGET_NAMES.includes(link.widget), `${link.widget} is a widget`);
    assert.ok(link.invoking.length <= 64 && link.invoked.length <= 64, `${tool}: status lines fit ChatGPT's limit`);
  }
  assert.equal(toolWidgetMeta('organization_list'), undefined);
  assert.equal(toolWidgetMeta('toString'), undefined);
  assert.deepEqual((toolWidgetMeta('ai_draft_reply') as { ui: unknown }).ui, {
    resourceUri: 'ui://firstreply/ReplyDraft.html',
    visibility: ['model', 'app'],
  });
});

test('widget data is a trimmed view of the result', () => {
  assert.equal(widgetData('organization_list', {}, { items: [] }), undefined);
  assert.equal(widgetData('conversation_list', {}, 'not an object'), undefined);

  const list = widgetData('conversation_list', { organizationId: 'o1' }, {
    items: [
      {
        id: 'c1',
        subject: 'Refund',
        status: 1,
        priority: 2,
        hasDraft: true,
        contact: { firstname: 'Dana', lastname: 'Lee', email: 'dana@example.com' },
        classification: { name: 'Billing' },
        lastMessage: { messagePlain: `  ${'word '.repeat(80)}`, messageHtml: '<p>never shown</p>' },
        lastUpdate: 5,
      },
    ],
  }) as { organizationId: string; conversations: Array<Record<string, unknown>> };
  assert.equal(list.organizationId, 'o1');
  const [row] = list.conversations;
  assert.equal(row.contact, 'Dana Lee');
  assert.equal(row.classification, 'Billing');
  assert.equal((row.preview as string).length, 160);
  assert.ok(!JSON.stringify(row).includes('never shown'));

  assert.deepEqual(widgetData('ai_draft_reply', { organizationId: 'o1', conversationId: 'c1' }, { result: 'Hello' }), {
    organizationId: 'o1',
    conversationId: 'c1',
    draft: 'Hello',
  });

  const post = widgetData('post_schedule', { organizationId: 'o1' }, {
    id: 'p1',
    status: 'SCHEDULED',
    content: 'Launch',
    scheduledAt: 10,
    media: [{ id: 'm1', url: 'https://storage.example/signed' }],
    targets: [{ channelId: 'ch1', platform: 'LINKEDIN', status: 'SCHEDULED', settings: '{"a":1}', accessToken: 'x' }],
  }) as { post: { media: number; targets: Array<Record<string, unknown>> } };
  assert.equal(post.post.media, 1);
  assert.deepEqual(Object.keys(post.post.targets[0]).filter((key) => post.post.targets[0][key] !== undefined), [
    'channelId',
    'platform',
    'status',
  ]);

  assert.equal((widgetData('conversation_reply', { message: 'Hi', draft: true }, { id: 'm1' }) as { title: string }).title, 'Draft saved');
  assert.equal((widgetData('conversation_reply', { message: 'Hi' }, { id: 'm1' }) as { title: string }).title, 'Reply sent');
  const connect = widgetData('channel_connect', {}, { authUrl: 'https://example.com/login', next: '...' }) as {
    link: { url: string };
  };
  assert.equal(connect.link.url, 'https://example.com/login');
});

test('the 401 gate asks for a sign-in without a token and a refresh for an expired one', () => {
  assert.deepEqual(authChallenge(null), {});
  assert.equal(authChallenge('fr_abc.def'), null);
  assert.equal(authChallenge('opaque'), null);
  assert.equal(jwtExpiry('fr_abc'), null);
  assert.equal(jwtExpiry('a.b.c'), null);
  assert.equal(jwtExpiry(jwt({ exp: 100 })), 100);
  assert.equal(authChallenge(jwt({ exp: 100 }), 99_000), null);
  assert.equal(authChallenge(jwt({ exp: 100 }), 100_000)?.error, 'invalid_token');
  assert.equal(authChallenge(jwt({ sub: 'no exp' })), null);
});

test('WWW-Authenticate stays one header line whatever the description holds', () => {
  const header = wwwAuthenticate('invalid_token', 'bad "token"\r\nX-Injected: 1');
  assert.ok(!/[\r\n]/.test(header));
  assert.match(header, /^Bearer resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource", error="invalid_token", error_description="bad \\"token\\"  X-Injected: 1"$/);
});
