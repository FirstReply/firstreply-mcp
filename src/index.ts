#!/usr/bin/env node
/**
 * stdio entry point for the FirstReply MCP server (Claude Desktop, CLIs).
 *
 * Usage: FIRSTREPLY_API_TOKEN=fr_... npx @firstreply/mcp
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FirstReply MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
