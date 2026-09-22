/**
 * FirstReply MCP tool set.
 *
 * Importing the domain modules registers their tools; the registry exposes
 * them as TOOL_DEFINITIONS and routes calls through dispatchTool.
 */

import './tools/organizations.js';
import './tools/inboxes.js';
import './tools/conversations.js';
import './tools/messages.js';
import './tools/contacts.js';
import './tools/classifications.js';
import './tools/knowledge.js';
import './tools/ai.js';
import './tools/search.js';
import './tools/templates.js';
import './tools/prompts.js';
import './tools/webhooks.js';
import './tools/filters.js';

export { TOOL_DEFINITIONS, dispatchTool } from './tools/registry.js';
export type { ToolDefinition } from './tools/registry.js';
