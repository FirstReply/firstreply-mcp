// End-to-end protocol tests against the BUILT server (npm test builds first): stdio and HTTP,
// protocol 2026-07-28 and the 2025 era, and the HTTP 401 gate. The FirstReply API is a local
// stub, so no real API is called.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { TOOL_DEFINITIONS } from '../src/tools.js';

// Compiled to dist/test/, next to dist/src/
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const API_KEY = 'fr_e2e_key';
const LEGACY_VERSION = '2025-06-18';
const MODERN_VERSION = '2026-07-28';

type Negotiation = ConstructorParameters<typeof Client>[1];
const ERAS: Array<[label: string, options: Negotiation, era: 'modern' | 'legacy']> = [
  ['2026-07-28 client pinned', { versionNegotiation: { mode: { pin: MODERN_VERSION } } }, 'modern'],
  ['2026-07-28 client in auto mode', { versionNegotiation: { mode: 'auto' } }, 'modern'],
  ['2025-era client', { versionNegotiation: { mode: 'legacy' } }, 'legacy'],
];

let apiStub: http.Server;
let apiUrl: string;
/** Requests the API stub received, as "METHOD /path Authorization". */
const apiCalls: string[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

before(async () => {
  apiStub = http.createServer((req, res) => {
    apiCalls.push(`${req.method} ${req.url?.split('?')[0]} ${req.headers.authorization}`);
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url?.startsWith('/v1/organizations?')) {
      res.end(JSON.stringify({ items: [{ id: 'org1', name: 'Acme' }], params: {} }));
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/organizations/org1/conversations/search') {
      res.end(JSON.stringify({ items: [{ id: 'c1', subject: 'Refund', status: 0, contact: { name: 'Dana' } }] }));
      return;
    }
    if (req.method === 'GET' && req.url === '/.well-known/oauth-authorization-server') {
      res.end(JSON.stringify({ issuer: apiUrl, registration_endpoint: `${apiUrl}/v1/oauth/register` }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'EntityNotFoundException', message: 'Not found' }));
  });
  const port = await freePort();
  await new Promise<void>((resolve) => apiStub.listen(port, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  apiStub.close();
});

/** Lists the tools, calls organization_list and checks that the call reached the API with the key. */
async function exercise(client: Client): Promise<void> {
  const { tools } = await client.listTools();
  assert.equal(tools.length, TOOL_DEFINITIONS.length);
  const list = tools.find((tool) => tool.name === 'conversation_list');
  assert.ok(list, 'conversation_list is listed');
  const schema = list.inputSchema as { properties: Record<string, { description?: string }>; required?: string[] };
  assert.match(schema.properties.organizationId.description ?? '', /organization id/);
  assert.deepEqual(schema.required, ['organizationId']);
  assert.equal(list.annotations?.readOnlyHint, true);
  assert.equal(list.title, 'Conversation List');

  apiCalls.length = 0;
  const result = await client.callTool({ name: 'organization_list', arguments: {} });
  assert.notEqual(result.isError, true);
  const content = result.content as Array<{ type: string; text: string }>;
  assert.equal(JSON.parse(content[0].text).items[0].id, 'org1');
  assert.deepEqual(apiCalls, [`GET /v1/organizations Bearer ${API_KEY}`]);

  // A tool with a widget: linked in its descriptor, and the result carries the widget's view
  // next to the text the model reads
  const ui = (list._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, 'ui://firstreply/ConversationList.html');
  const listed = await client.callTool({ name: 'conversation_list', arguments: { organizationId: 'org1' } });
  assert.equal(JSON.parse((listed.content as Array<{ text: string }>)[0].text).items[0].id, 'c1');
  assert.deepEqual((listed.structuredContent as { conversations: unknown[] }).conversations[0], {
    id: 'c1',
    subject: 'Refund',
    status: 0,
    contact: 'Dana',
  });

  const { resources } = await client.listResources();
  assert.deepEqual(
    resources.map((resource) => resource.uri).sort(),
    ['ConversationList', 'PostAnalytics', 'PostCard', 'ReplyDraft', 'ResultCard'].map((name) => `ui://firstreply/${name}.html`),
  );
  assert.ok(resources.every((resource) => resource.mimeType === 'text/html;profile=mcp-app'));
  const widget = await client.readResource({ uri: 'ui://firstreply/ResultCard.html' });
  const html = widget.contents[0] as { mimeType?: string; text: string };
  assert.equal(html.mimeType, 'text/html;profile=mcp-app');
  assert.match(html.text, /^<!DOCTYPE html>[\s\S]*<div id="root"><\/div>/);

  // An API error stays a tool error instead of failing the request
  const failed = await client.callTool({ name: 'conversation_get', arguments: { organizationId: 'org1', conversationId: 'c1' } });
  assert.equal(failed.isError, true);
  assert.match((failed.content as Array<{ text: string }>)[0].text, /404/);
}

describe('stdio', () => {
  for (const [label, options, era] of ERAS) {
    test(`${label}: era ${era}, tools listed and called`, async () => {
      const client = new Client({ name: 'e2e', version: '1' }, options);
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [path.join(dist, 'index.js')],
          env: { ...process.env, FIRSTREPLY_API_TOKEN: API_KEY, FIRSTREPLY_API_URL: apiUrl } as Record<string, string>,
          stderr: 'ignore',
        }),
      );
      try {
        assert.equal(client.getProtocolEra(), era);
        await exercise(client);
      } finally {
        await client.close();
      }
    });
  }
});

describe('http', () => {
  let child: ChildProcess;
  let baseUrl: string;

  before(async () => {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      FIRSTREPLY_API_URL: apiUrl,
      MCP_SERVER_URL: 'https://mcp.example.test/',
    };
    delete env.FIRSTREPLY_API_TOKEN; // the token must come from the request
    child = spawn(process.execPath, [path.join(dist, 'http-server.js')], { env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${baseUrl}/health`)).ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('http server did not start');
  });

  after(() => {
    child.kill();
  });

  for (const [label, options, era] of ERAS) {
    test(`${label} with an API key: era ${era}, tools listed and called`, async () => {
      const client = new Client({ name: 'e2e', version: '1' }, options);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${baseUrl}/`), {
          requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
        }),
      );
      try {
        assert.equal(client.getProtocolEra(), era);
        await exercise(client);
      } finally {
        await client.close();
      }
    });
  }

  test('a 2025-era initialize negotiates the requested version', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'e2e', version: '1' } },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.text();
    const json = response.headers.get('content-type')?.includes('text/event-stream')
      ? JSON.parse(body.split('\n').find((line) => line.startsWith('data: '))!.slice(6))
      : JSON.parse(body);
    assert.equal(json.result.protocolVersion, LEGACY_VERSION);
    assert.equal(json.result.serverInfo.name, 'firstreply-mcp');
  });

  test('requests without an API key get the 401 challenge, in both eras', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(response.status, 401);
    // MCP hosts start their sign-in from this pointer
    assert.match(
      response.headers.get('www-authenticate') ?? '',
      /^Bearer resource_metadata="https:\/\/mcp\.example\.test\/\.well-known\/oauth-protected-resource"$/,
    );

    const client = new Client({ name: 'e2e', version: '1' }, { versionNegotiation: { mode: { pin: MODERN_VERSION } } });
    await assert.rejects(client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/`))));
  });

  test('an expired access token is refused with invalid_token, so the host refreshes it', async () => {
    const jwt = (exp: number) =>
      `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'u1', exp })).toString('base64url')}.sig`;
    const post = (token: string) =>
      fetch(`${baseUrl}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'e2e', version: '1' } },
        }),
      });
    const expired = await post(jwt(Math.floor(Date.now() / 1000) - 60));
    assert.equal(expired.status, 401);
    assert.match(expired.headers.get('www-authenticate') ?? '', /error="invalid_token"/);
    assert.equal((await post(jwt(Math.floor(Date.now() / 1000) + 600))).status, 200);
  });

  test('the discovery documents name this server and the API as authorization server', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const resource = (await (await fetch(`${baseUrl}${path}`)).json()) as Record<string, unknown>;
      assert.equal(resource.resource, 'https://mcp.example.test');
      assert.deepEqual(resource.authorization_servers, [apiUrl]);
    }
    // The API's own document, served from this origin for older clients
    const server = (await (await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).json()) as Record<string, unknown>;
    assert.equal(server.registration_endpoint, `${apiUrl}/v1/oauth/register`);
  });

  test('the server card names the server and its endpoint', async () => {
    const card = (await (await fetch(`${baseUrl}/.well-known/mcp/server-card.json`)).json()) as Record<string, any>;
    assert.equal(card.serverInfo.name, 'firstreply-mcp');
    assert.match(card.serverInfo.version, /^\d+\.\d+\.\d+/);
    assert.equal(card.transport.endpoint, 'https://mcp.example.test/');
  });

  test('CORS preflight allows the 2026-07-28 headers', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'mcp-method, mcp-name, mcp-protocol-version, authorization',
      },
    });
    assert.equal(response.status, 204);
    const allowed = (response.headers.get('access-control-allow-headers') ?? '').toLowerCase();
    for (const header of ['mcp-method', 'mcp-name', 'mcp-protocol-version', 'authorization']) {
      assert.ok(allowed.includes(header), `${header} is allowed`);
    }
  });
});
