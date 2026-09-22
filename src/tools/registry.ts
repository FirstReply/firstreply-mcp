/**
 * Tool registry of the FirstReply MCP server.
 *
 * The domain modules in this directory declare their tools with add(). Input
 * schemas are zod shapes: the MCP SDK validates arguments against them and
 * publishes them as JSON Schema. Every tool calls the FirstReply REST API
 * through FirstReplyClient; all endpoints are organization-scoped and
 * permission-checked server-side.
 */

import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { FirstReplyClient } from '../client.js';

export type ToolShape = z.ZodRawShape;

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ToolShape;
  annotations: ToolAnnotations;
}

export type ToolArgs<Shape extends ToolShape> = z.infer<z.ZodObject<Shape>>;
type ToolHandler<Shape extends ToolShape> = (client: FirstReplyClient, args: ToolArgs<Shape>) => Promise<unknown>;

interface RegisteredTool {
  schema: z.ZodObject<ToolShape>;
  handler: ToolHandler<ToolShape>;
}

const definitions: ToolDefinition[] = [];
const registered = new Map<string, RegisteredTool>();

export const READ: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

export const str = (description: string) => z.string().min(1).describe(description);
export const optStr = (description: string) => z.string().describe(description).optional();
export const num = (description: string) => z.number().int().describe(description);
export const optNum = (description: string) => z.number().int().describe(description).optional();
export const optBool = (description: string) => z.boolean().describe(description).optional();
export const optStrList = (description: string) => z.array(z.string().min(1)).describe(description).optional();
export const optEnum = (values: readonly [string, ...string[]], description: string) =>
  z.enum([...values]).describe(description).optional();
export const optDate = (description: string) =>
  z.string().describe(`${description} ISO 8601 date or date-time, e.g. 2026-09-01 or 2026-09-01T12:00:00Z.`).optional();

export const ORG_ID = str('The organization id. Use organization_list to find it.');
export const CONVERSATION_ID = str('The conversation id.');
export const PAGE = z.number().int().min(1).describe('Page number, starting at 1.').optional();
export const LIMIT = z.number().int().min(1).max(50).describe('Maximum items to return (default 10, max 50).').optional();

export function orgPath(organizationId: string, suffix = ''): string {
  return `/v1/organizations/${organizationId}${suffix}`;
}

export function paging(args: { page?: number; limit?: number }, fallback = 10): { page: number; limit: number } {
  return { page: args.page ?? 1, limit: args.limit ?? fallback };
}

/** Wraps one id in a list, as the search endpoints expect. */
export function idList(id: string | undefined): string[] | undefined {
  return id ? [id] : undefined;
}

/** Converts an ISO 8601 date or date-time into the epoch milliseconds the API expects. */
export function epochMillis(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) {
    throw new Error(`Invalid date "${value}": use ISO 8601, e.g. 2026-09-01 or 2026-09-01T12:00:00Z.`);
  }
  return millis;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

function humanTitle(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function add<Shape extends ToolShape>(
  name: string,
  description: string,
  shape: Shape,
  annotations: ToolAnnotations,
  handler: ToolHandler<Shape>,
): void {
  if (registered.has(name)) {
    throw new Error(`Duplicate tool: ${name}`);
  }
  definitions.push({ name, title: humanTitle(name), description, inputSchema: shape, annotations });
  registered.set(name, {
    schema: z.object(shape) as unknown as z.ZodObject<ToolShape>,
    handler: handler as unknown as ToolHandler<ToolShape>,
  });
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = definitions;

/** Validates the arguments and runs the tool. Returns null when no tool has that name. */
export async function dispatchTool(client: FirstReplyClient, name: string, args: unknown): Promise<unknown | null> {
  const tool = registered.get(name);
  if (!tool) return null;
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) {
    throw new Error(formatIssues(parsed.error));
  }
  return tool.handler(client, parsed.data);
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.') || '(arguments)';
      const missing = issue.code === 'invalid_type' && /received undefined/.test(issue.message);
      return missing ? `Missing required argument: ${path}` : `${path}: ${issue.message}`;
    })
    .join('; ');
}
