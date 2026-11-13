/**
 * Stateless HTTP entry point for the FirstReply MCP server.
 *
 * Every POST carries `Authorization: Bearer <token>`: an organization API key (fr_...) or the
 * access token of an OAuth sign-in. Without one the answer is a 401 that points MCP hosts at
 * the discovery documents below, which is how Claude and ChatGPT start their sign-in; the
 * FirstReply API is the authorization server (see auth.ts). One handler serves
 * both protocol eras: 2026-07-28 requests (per-request _meta envelope) are answered
 * by the SDK directly, 2025-era requests (initialize, claim-less calls) by a fresh
 * server over a stateless streamable HTTP transport. Every request gets its own
 * server instance; the FirstReply API holds all state. Modeled on the Timesheet
 * MCP http server.
 */

import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  apiUrl,
  authChallenge,
  documentProxy,
  extractBearerToken,
  protectedResourceMetadata,
  serverUrl,
  wwwAuthenticate,
} from './auth.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const PORT = Number(process.env.PORT ?? 8080);
// The landing page and its logo (public/, next to dist/).
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));
const ENDPOINT_PATH = process.env.MCP_ENDPOINT_PATH ?? '/';

const mcpHandler = createMcpHandler(({ authInfo }) => createServer({ token: authInfo?.token }), {
  legacy: 'stateless',
  onerror: (error) => console.error('[MCP] handler:', error),
});
const handleMcp = toNodeHandler(mcpHandler, {
  onerror: (error) => console.error('[MCP] adapter:', error),
});

const app = express();
app.use(express.json({ limit: '4mb' }));

app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // Mcp-Method / Mcp-Name ride on every 2026-07-28 request; without them a browser
  // client's preflight fails and it silently falls back to the 2025 protocol.
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Mcp-Name',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', name: SERVER_NAME, version: SERVER_VERSION });
});

// Protected resource metadata (RFC 9728), also under the endpoint's path as hosts may ask for it
app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/*'], (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=3600').json(protectedResourceMetadata());
});

// MCP Server Card (SEP-1649): what this server is and where its endpoint is, without connecting
app.get('/.well-known/mcp/server-card.json', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=3600').json({
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    serverInfo: { name: SERVER_NAME, title: 'FirstReply', version: SERVER_VERSION },
    description:
      'FirstReply as tools for an AI assistant: read and answer customer conversations, manage contacts, channels and the knowledge base, and plan social posts.',
    documentationUrl: 'https://docs.firstreply.ai/developers/mcp-server',
    transport: { type: 'streamable-http', endpoint: `${serverUrl()}${ENDPOINT_PATH}` },
    authentication: { required: true, schemes: ['oauth2', 'bearer'] },
    capabilities: { tools: {}, resources: {} },
  });
});

const authorizationServerMetadata = documentProxy(`${apiUrl()}/.well-known/oauth-authorization-server`);
app.get('/.well-known/oauth-authorization-server', async (_req: Request, res: Response) => {
  const { status, body } = await authorizationServerMetadata();
  if (status === 200) res.set('Cache-Control', 'public, max-age=3600');
  res.status(status).json(body);
});

app.post(ENDPOINT_PATH, async (req: Request, res: Response) => {
  const token = extractBearerToken(req.headers.authorization);
  const challenge = authChallenge(token);
  if (!token || challenge) {
    res
      .status(401)
      .set('WWW-Authenticate', wwwAuthenticate(challenge?.error, challenge?.description))
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message:
            challenge?.description ??
            'Authentication required: sign in, or send "Authorization: Bearer <FirstReply organization API key (fr_...)>".',
        },
        id: null,
      });
    return;
  }

  // The API verifies the key on every call; the handler passes it to createServer as authInfo.
  const auth: AuthInfo = { token, clientId: 'unknown', scopes: [] };
  await handleMcp(Object.assign(req, { auth }), res, req.body);
});

// A browser gets the landing page; an MCP client that tries to open a stream gets the 405.
app.get(ENDPOINT_PATH, (req: Request, res: Response, next) => {
  if (req.headers.accept?.includes('text/html')) {
    next();
    return;
  }
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Stateless server: use POST.' },
    id: null,
  });
});

app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

app.listen(PORT, () => {
  console.error(`FirstReply MCP server listening on :${PORT} (endpoint ${ENDPOINT_PATH}, protocol 2025-* and 2026-07-28)`);
});
