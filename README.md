# FirstReply MCP Server

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server that exposes
FirstReply customer support operations as tools for AI assistants like Claude.

## Tools

| Tool | Description |
|------|-------------|
| `organization_list` | List accessible organizations |
| `inbox_list` | List support inboxes of an organization |
| `member_list` | List organization members |
| `api_key_list` | List the organization's named API keys (metadata only) |
| `api_key_create` | Create a named API key; plaintext returned once |
| `api_key_delete` | Delete (revoke) an API key (destructive) |
| `conversation_list` | List/filter customer conversations |
| `conversation_get` | Get one conversation |
| `conversation_messages` | List the messages of a conversation |
| `conversation_reply` | Send a reply to the customer (destructive) |
| `conversation_close` | Close a conversation |
| `conversation_update` | Assign / reprioritize / reclassify a conversation |
| `conversation_stats` | Conversation statistics for a date range |
| `conversation_totals` | Current open/unread totals |
| `ai_draft_reply` | Generate an AI reply draft without sending it |

## Authentication

The server authenticates against the FirstReply REST API with an
**organization API key** (`fr_...`), created in FirstReply under
Organization → Development → API Keys. Organizations support multiple named
keys with optional expiry, so it is best to create a dedicated key for this
MCP server. The key is sent as `Authorization: Bearer`.

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
```
