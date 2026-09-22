/**
 * FirstReply MCP server: one tool definition set, two transports
 * (stdio via index.ts, stateless streamable HTTP via http-server.ts).
 */

import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { FirstReplyApiError, FirstReplyClient } from './client.js';
import { dispatchTool, TOOL_DEFINITIONS } from './tools.js';

const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

export const SERVER_NAME = 'firstreply-mcp';
export const SERVER_VERSION: string = version;

export interface FirstReplyServerOptions {
  /** Bearer token: an organization API key ("fr_...") or user JWT. */
  token?: string;
}

export function createServer(options: FirstReplyServerOptions = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

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

  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args) => {
        try {
          const result = await dispatchTool(getClient(), tool.name, args);
          if (result === null) {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${tool.name}`);
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          if (error instanceof McpError) throw error;
          return {
            content: [{ type: 'text' as const, text: formatError(error) }],
            isError: true,
          };
        }
      },
    );
  }

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
