/**
 * Stateless HTTP entry point for the FirstReply MCP server.
 *
 * Every POST carries `Authorization: Bearer <fr_... api key>`. One handler serves
 * both protocol eras: 2026-07-28 requests (per-request _meta envelope) are answered
 * by the SDK directly, 2025-era requests (initialize, claim-less calls) by a fresh
 * server over a stateless streamable HTTP transport. Every request gets its own
 * server instance; the FirstReply API holds all state. Modeled on the Timesheet
 * MCP http server.
 */

import express from 'express';
import type { Request, Response } from 'express';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const PORT = Number(process.env.PORT ?? 8080);
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

app.post(ENDPOINT_PATH, async (req: Request, res: Response) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res
      .status(401)
      .set('WWW-Authenticate', 'Bearer realm="FirstReply MCP", error="invalid_token"')
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required: send "Authorization: Bearer <FirstReply organization API key (fr_...)>".',
        },
        id: null,
      });
    return;
  }

  // The API verifies the key on every call; the handler passes it to createServer as authInfo.
  const auth: AuthInfo = { token, clientId: 'unknown', scopes: [] };
  await handleMcp(Object.assign(req, { auth }), res, req.body);
});

app.get(ENDPOINT_PATH, (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Stateless server: use POST.' },
    id: null,
  });
});

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

app.listen(PORT, () => {
  console.error(`FirstReply MCP server listening on :${PORT} (endpoint ${ENDPOINT_PATH}, protocol 2025-* and 2026-07-28)`);
});
