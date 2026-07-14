/**
 * Stateless streamable-HTTP entry point for the FirstReply MCP server.
 *
 * Every POST carries `Authorization: Bearer <fr_... api key>`; a fresh server +
 * transport pair is created per request and torn down afterwards (the FirstReply
 * API holds all state). Modeled on the Timesheet MCP http server.
 */

import express from 'express';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const PORT = Number(process.env.PORT ?? 8080);
const ENDPOINT_PATH = process.env.MCP_ENDPOINT_PATH ?? '/';

const app = express();
app.use(express.json({ limit: '4mb' }));

app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
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

  const server = createServer({ token });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
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
  console.error(`FirstReply MCP server listening on :${PORT} (endpoint ${ENDPOINT_PATH})`);
});
