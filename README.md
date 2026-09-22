# FirstReply MCP Server

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server that exposes
[FirstReply](https://firstreply.ai) customer support operations as tools for AI
assistants like Claude. It lets an assistant browse and answer customer
conversations, look up contacts, search and maintain the knowledge base, draft
and translate replies, manage classifications, templates, prompts, webhooks and
saved filters, pull support statistics and manage organization API keys, all
scoped and permission-checked by the FirstReply REST API.

## Tools

Tools are named `resource_action`. Every organization-scoped tool takes an
`organizationId` (see `organization_list`). Tools that send something to a
customer or delete data are annotated as destructive.

### Organization, members & API keys

| Tool | Description |
|------|-------------|
| `organization_list` | List accessible organizations |
| `organization_get` | Get an organization with its settings and AI prompts |
| `organization_update` | Update name, language, auto-close and the custom AI prompts |
| `organization_usage` | Plan, trial state and inbox / member counts against the limits |
| `member_list` | List organization members |
| `member_get` | Get one member |
| `member_create` | Add a member by email with a permission level |
| `member_update` | Change a member's permission level |
| `member_delete` | Remove a member (destructive) |
| `api_key_list` | List the organization's named API keys (metadata only) |
| `api_key_create` | Create a named API key; plaintext returned once |
| `api_key_delete` | Delete (revoke) an API key (destructive) |

### Inboxes

| Tool | Description |
|------|-------------|
| `inbox_list` | List the inboxes (email, WhatsApp, Messenger, Instagram, LinkedIn, Google Play, App Store, website chat) |
| `inbox_get` | Get one inbox |
| `inbox_statistics` | Statistics per inbox |
| `inbox_refresh` | Fetch new messages from an inbox now |
| `inbox_test` | Test the connection of an inbox to its platform |

### Conversations & messages

| Tool | Description |
|------|-------------|
| `conversation_list` | List / filter / search conversations (status, inbox, member, contact, classification, language, spam, priority, date ranges, search operators) |
| `conversation_get` | Get one conversation |
| `conversation_thread` | Get a conversation with all of its messages |
| `conversation_messages` | List the messages of a conversation |
| `conversation_reply` | Send a reply to the customer, or store an internal note or a draft (destructive) |
| `conversation_close` | Close a conversation |
| `conversation_read` | Mark a conversation as read |
| `conversation_spam` | Mark a conversation as spam or not spam |
| `conversation_update` | Assign, reprioritize, reclassify, rename, change language, contact or spam flag |
| `conversation_delete` | Delete a conversation (destructive) |
| `conversation_stats` | Conversation statistics for a date range |
| `conversation_stats_by_member` | Statistics per member for a date range |
| `conversation_metrics` | Response and resolution metrics for a date range |
| `conversation_totals` | Current open / unread totals |
| `message_get` | Get one message |
| `message_update` | Edit a draft or internal note |
| `message_send` | Send a draft (destructive) |
| `message_delete` | Delete a message (destructive) |

The `search` argument of `conversation_list`, `search` and the saved filters
understands the FirstReply search syntax: words are AND-ed and prefix matched,
`"quoted phrases"`, `-word`, and the operators `from:`, `subject:`, `is:`
(`open`, `closed`, `unread`, `read`, `assigned`, `unassigned`, `ai`), `has:`
(`attachment`, `draft`), `before:` and `after:` (`YYYY-MM-DD`).

### Contacts

| Tool | Description |
|------|-------------|
| `contact_list` | List / search contacts |
| `contact_get` | Get one contact with custom fields |
| `contact_create` | Create a contact |
| `contact_update` | Update a contact |
| `contact_delete` | Delete a contact (destructive) |
| `contact_field_list` | List the custom contact fields |

### Classifications

| Tool | Description |
|------|-------------|
| `classification_list` | List classifications with their automation settings |
| `classification_get` | Get one classification |
| `classification_create` | Create a classification |
| `classification_update` | Update a classification (unchanged settings are kept) |
| `classification_delete` | Delete a classification, optionally moving its conversations (destructive) |
| `classification_impact` | Preview what deleting a classification affects |
| `classification_statistics` | Conversation counts per classification |

### Knowledge base

| Tool | Description |
|------|-------------|
| `knowledge_search` | Search or browse knowledge entries |
| `knowledge_get` | Get one knowledge entry |
| `knowledge_create` | Add a question / answer entry |
| `knowledge_update` | Update a knowledge entry |
| `knowledge_delete` | Delete a knowledge entry (destructive) |
| `knowledge_source_list` | List synced knowledge sources with their sync state |
| `knowledge_source_get` | Get one knowledge source |
| `knowledge_source_sync` | Start a sync now |
| `knowledge_source_status` | Sync status of a source |

Knowledge source configurations hold credentials and are never returned.

### AI & search

| Tool | Description |
|------|-------------|
| `ai_draft_reply` | Generate an AI reply draft for a conversation without sending it |
| `ai_prompt` | Run a free-form prompt with the organization's persona and knowledge |
| `ai_translate` | Translate a text, e.g. a reply into the customer's language |
| `ai_test` | Simulate an incoming message: classification, spam verdict and reply |
| `search` | Global search across conversations, contacts, knowledge and messages |

### Templates, prompts, webhooks & filters

| Tool | Description |
|------|-------------|
| `template_list` / `template_get` / `template_create` / `template_update` / `template_delete` | Reply templates and their language variants |
| `prompt_list` / `prompt_get` / `prompt_create` / `prompt_update` / `prompt_delete` | Saved AI prompts |
| `webhook_list` / `webhook_get` / `webhook_create` / `webhook_update` / `webhook_delete` | Webhooks and their events |
| `webhook_test` | Send a test event to a webhook |
| `webhook_rotate_secret` | Generate a new signing secret (returned once) |
| `filter_list` / `filter_get` / `filter_create` / `filter_update` / `filter_delete` | Saved conversation filters |

Not covered, by design: authentication and profile endpoints, inbox creation and
OAuth connections, knowledge source creation, billing, attachments and CSV
import / export. Those stay in the FirstReply web app.

## Requirements

- Node.js >= 18
- A FirstReply organization API key

## Authentication

The server authenticates against the FirstReply REST API with an
**organization API key** (`fr_...`), created in FirstReply under
Organization → Development → API Keys. Organizations support multiple named
keys with optional expiry, so it is best to create a dedicated key for this
MCP server. The key is sent as `Authorization: Bearer`.

API key requests run with the permissions of the organization owner: treat
the key as a secret and rotate it by creating a new key and deleting the old
one.

## Usage (stdio, e.g. Claude Desktop)

```json
{
  "mcpServers": {
    "firstreply": {
      "command": "npx",
      "args": ["-y", "@firstreply/mcp"],
      "env": {
        "FIRSTREPLY_API_TOKEN": "fr_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add firstreply --env FIRSTREPLY_API_TOKEN=fr_... -- npx -y @firstreply/mcp
```

## Usage (HTTP)

```bash
npm run build && npm run start:http   # listens on :8080
```

Stateless streamable-HTTP transport; every request must carry
`Authorization: Bearer fr_...`. A `/health` endpoint is provided for probes.

## Environment variables

| Variable | Description |
|----------|-------------|
| `FIRSTREPLY_API_TOKEN` | Organization API key (stdio mode) |
| `FIRSTREPLY_API_URL` | API base URL (default `https://api.firstreply.ai`) |
| `PORT` | HTTP port (HTTP mode, default 8080) |
| `MCP_ENDPOINT_PATH` | HTTP endpoint path (default `/`) |

## Development

```bash
npm install
npm run typecheck
npm test          # builds and runs node:test suites
npm run build     # compiles TypeScript to dist/
```

### Project structure

```
src/
├── index.ts              # stdio entry point
├── http-server.ts        # streamable-HTTP entry point (Express)
├── server.ts             # MCP server wiring (McpServer + registerTool)
├── tools.ts              # loads the tool modules, exposes the registry
├── tools/registry.ts     # add() builder, schema helpers, dispatch
├── tools/<resource>.ts   # one module per resource (conversations, contacts, ...)
└── client.ts             # minimal FirstReply REST client
test/
└── tools.test.ts         # tool definition checks and handler tests against a fake client
```

Adding a tool: call `add(name, description, zodShape, annotations, handler)`
in the matching `src/tools/<resource>.ts`. The zod shape is validated by the
SDK and published to clients as JSON Schema; every argument needs a
description (the tests check).
