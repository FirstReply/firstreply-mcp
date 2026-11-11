/**
 * FirstReply MCP server: one tool definition set, two transports
 * (stdio via index.ts, stateless HTTP via http-server.ts). Both serve protocol
 * 2026-07-28 and the 2025-era revisions; createServer is the per-request (HTTP)
 * or per-connection (stdio) factory the SDK calls.
 */

import { createRequire } from 'node:module';
import { McpServer, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { FirstReplyApiError, FirstReplyClient } from './client.js';
import { dispatchTool, TOOL_DEFINITIONS } from './tools.js';
import {
  readWidget,
  toolWidgetMeta,
  WIDGET_MIME_TYPE,
  WIDGET_NAMES,
  widgetData,
  widgetDescription,
  widgetResourceMeta,
  widgetUri,
} from './widgets.js';

const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

export const SERVER_NAME = 'firstreply-mcp';
export const SERVER_VERSION: string = version;

export interface FirstReplyServerOptions {
  /** Bearer token: an organization API key ("fr_...") or the access token of an OAuth sign-in (a user JWT). */
  token?: string;
}

export function createServer(options: FirstReplyServerOptions = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  let client: FirstReplyClient | null = null;
  const getClient = (): FirstReplyClient => {
    if (!client) {
      const token = options.token ?? process.env.FIRSTREPLY_API_TOKEN;
      if (!token) {
        throw new ProtocolError(
          ProtocolErrorCode.InternalError,
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
        inputSchema: z.object(tool.inputSchema),
        annotations: tool.annotations,
        _meta: toolWidgetMeta(tool.name),
      },
      async (args) => {
        try {
          const result = await dispatchTool(getClient(), tool.name, args);
          if (result === null) {
            throw new ProtocolError(ProtocolErrorCode.MethodNotFound, `Unknown tool: ${tool.name}`);
          }
          // The text is what the model reads on every host; the widget gets its own view of it
          const structuredContent = widgetData(tool.name, args as Record<string, unknown>, result);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            ...(structuredContent ? { structuredContent } : {}),
          };
        } catch (error) {
          if (error instanceof ProtocolError) throw error;
          return {
            content: [{ type: 'text' as const, text: formatError(error) }],
            isError: true,
          };
        }
      },
    );
  }

  for (const name of WIDGET_NAMES) {
    const uri = widgetUri(name);
    const _meta = widgetResourceMeta(name);
    server.registerResource(
      `${name} widget`,
      uri,
      { description: widgetDescription(name), mimeType: WIDGET_MIME_TYPE, _meta },
      async () => ({ contents: [{ uri, mimeType: WIDGET_MIME_TYPE, text: await readWidget(name), _meta }] }),
    );
  }

  return server;
}

function formatError(error: unknown): string {
  if (error instanceof FirstReplyApiError) {
    if (error.status === 401) {
      return 'Authentication failed (401). Sign in again, or check that the organization API key (fr_...) is valid; regenerate it in FirstReply under Organization Settings if needed.';
    }
    if (error.status === 402) {
      return 'This feature is not available on the organization\'s current plan (402). Upgrade the plan in FirstReply to use it.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
