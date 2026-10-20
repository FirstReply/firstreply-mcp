#!/usr/bin/env node
/**
 * stdio entry point for the FirstReply MCP server (Claude Desktop, CLIs).
 *
 * Usage: FIRSTREPLY_API_TOKEN=fr_... npx @firstreply/mcp
 *
 * serveStdio answers both protocol eras: a 2025-era `initialize` pins the
 * connection to one server instance, a 2026-07-28 client is answered per request.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(() => createServer(), {
  onerror: (error) => console.error('[MCP] stdio:', error),
});
console.error('FirstReply MCP server running on stdio (protocol 2025-* and 2026-07-28)');
