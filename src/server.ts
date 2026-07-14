/**
 * FirstReply MCP server: one tool definition set, two transports
 * (stdio via index.ts, stateless streamable HTTP via http-server.ts).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { FirstReplyApiError, FirstReplyClient } from './client.js';
import { dispatchTool, TOOL_DEFINITIONS } from './tools.js';

export const SERVER_NAME = 'firstreply-mcp';
export const SERVER_VERSION = '0.1.0';

export interface FirstReplyServerOptions {
  /** Bearer token: an organization API key ("fr_...") or user JWT. */
  token?: string;
}

export function createServer(options: FirstReplyServerOptions = {}): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  let client: FirstReplyClient | null = null;
  const getClient = (): FirstReplyClient => {
    if (!client) {
      const token = options.token ?? process.env.FIRSTREPLY_API_TOKEN;
      if (!token) {
        throw new McpError(
          ErrorCode.InternalError,
          'Authentication required: set the FIRSTREPLY_API_TOKEN environment variable to a FirstReply organization API key (fr_...). Generate one in FirstReply under Organization Settings.',
        );
      }
      client = new FirstReplyClient(token);
    }
    return client;
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS.map((tool) => ({ ...tool })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await dispatchTool(getClient(), name, args ?? {});
      if (result === null) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      return {
        content: [{ type: 'text', text: formatError(error) }],
        isError: true,
      };
    }
  });

  return server;
}

function formatError(error: unknown): string {
  if (error instanceof FirstReplyApiError) {
    if (error.status === 401) {
      return 'Authentication failed (401). Check that FIRSTREPLY_API_TOKEN is a valid organization API key (fr_...); regenerate it in FirstReply under Organization Settings if needed.';
    }
    if (error.status === 402) {
      return 'This feature is not available on the organization\'s current plan (402). Upgrade the plan in FirstReply to use it.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
