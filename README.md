# FirstReply MCP Server

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server that exposes
[FirstReply](https://firstreply.ai) customer support operations as tools for AI
assistants like Claude. It lets an assistant browse and answer customer
conversations, look up contacts, search and maintain the knowledge base, draft
and translate replies, draft and schedule social media posts, manage
classifications, templates, prompts, webhooks and saved filters, pull support
and publishing statistics and manage organization API keys, all
scoped and permission-checked by the FirstReply REST API.

The server speaks MCP protocol `2026-07-28` and the earlier `2025-*` revisions
over stdio and HTTP, built on the v2 MCP TypeScript SDK.

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
| `organization_usage` | Plan, trial state and channel / member counts against the limits |
| `member_list` | List organization members |
| `member_get` | Get one member |
| `member_create` | Add a member by email with a permission level |
| `member_update` | Change a member's permission level |
| `member_delete` | Remove a member (destructive) |
| `api_key_list` | List the organization's named API keys (metadata only) |
| `api_key_create` | Create a named API key; plaintext returned once |
| `api_key_delete` | Delete (revoke) an API key (destructive) |

### Channels

| Tool | Description |
|------|-------------|
| `channel_list` | List the channels (email, website chat, WhatsApp, Facebook Page, Instagram, LinkedIn, Threads, X, TikTok, YouTube, Google Business Profile, Bluesky, Mastodon, Telegram, Google Play, App Store) and whether Publishing is on |
| `channel_get` | Get one channel |
| `channel_statistics` | Statistics per channel |
| `channel_refresh` | Fetch new messages from a channel now |
| `channel_test` | Test the connection of a channel to its platform |
| `channel_create` | Create a channel from settings or credentials: email, website chat, Bluesky, Telegram, App Store, Google Play |
| `channel_connect` | Start connecting (or reconnecting) an account that signs in on the platform; returns the login link |
| `channel_update` | Rename, pause, turn Publishing and comment handling on or off, change settings or credentials |
| `channel_playstore_service_account` | The organization's Google service account to invite in the Play Console |
| `channel_tiktok_creator_info` | What a TikTok channel may post right now (privacy levels, interactions, video length) |

Facebook Pages, Instagram, LinkedIn, WhatsApp, Threads, X, TikTok, YouTube,
Google Business Profile and Mastodon are connected by signing in on the
platform. `channel_connect` returns the login link; the user opens it in a
browser where they are signed in to FirstReply (as the organization's owner,
which an API key acts as) and finishes there. The link is valid for 10
minutes. There is no tool to delete a channel.

### Conversations & messages

| Tool | Description |
|------|-------------|
| `conversation_list` | List / filter / search conversations (status, channel, member, contact, classification, language, spam, priority, date ranges, search operators) |
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

### Social posts

| Tool | Description |
|------|-------------|
| `post_list` | List / filter posts (status, channel, period, text); `order: asc` for upcoming posts |
| `post_get` | Get a post with its channels, publish state and latest metrics |
| `post_metrics` | Metric snapshots of every channel of a published post |
| `post_comments` | The comment threads on a post, as conversations |
| `post_write` | Write, shorten or rewrite a post text with AI, for a platform and a character limit; saves nothing |
| `post_media_upload` | Upload an image or video from a public https address; returns the media id for a post |
| `post_create` | Save a post as a draft, with media and per-channel text and settings |
| `post_schedule` | Schedule a new post or an existing draft for a time on the given channels |
| `post_reschedule` | Move a post to another time; text, channels and media stay |
| `post_analytics` | Totals, daily series, top posts and channels for a period |

Posts target channels with Publishing on (`publishingEnabled` in `channel_list`),
given as `channelIds` or as `targets` with a text of their own and the
platform's settings (YouTube title and made-for-kids choice, TikTok privacy
level, Instagram post type, X thread parts, ...).
There is no tool to publish right away, approve, retry or delete a post: a
public post cannot be taken back, so the assistant drafts or schedules and a
person can still change it. Scheduled times have to be at least 10 minutes
ahead. When the organization requires approval, a member's scheduled post
waits for a manager (status `PENDING_APPROVAL`); such a post is not
rescheduled with manager rights (an API key acts as the owner), since saving
it would approve it. Comments are only read: hiding, deleting or liking a
comment and answering it privately act publicly on the platform and stay in
FirstReply.

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
| `webhook_list` / `webhook_get` / `webhook_create` / `webhook_update` / `webhook_delete` | Webhooks and their events (including `post.create`, `post.update`, `post.delete`) |
| `webhook_test` | Send a test event to a webhook |
| `webhook_rotate_secret` | Generate a new signing secret (returned once) |
| `filter_list` / `filter_get` / `filter_create` / `filter_update` / `filter_delete` | Saved conversation filters |

Not covered, by design: authentication and profile endpoints, channel creation and
OAuth connections, knowledge source creation, billing, attachments and CSV
import / export, publishing posts right away, approving posts, media
uploads, comment moderation and private replies to comments. Those stay in the
FirstReply web app.

## Widgets

Hosts that support MCP Apps (Claude, ChatGPT) show some results as a small view
next to the answer:

| Widget | Tools | What it shows |
|---|---|---|
| `ConversationList` | `conversation_list` | Contact, subject, last message, status and classification per conversation |
| `ReplyDraft` | `ai_draft_reply` | The draft in a text field, with Send reply, Save as draft and Copy |
| `PostCard` | `post_get`, `post_create`, `post_schedule`, `post_reschedule` | The post, its time and the status per channel |
| `PostAnalytics` | `post_analytics` | Totals, views per day and numbers per channel |
| `ResultCard` | `conversation_reply`, `conversation_close`, `channel_connect`, `channel_create`, `channel_update` | A confirmation, or the sign-in link of a channel |

Send reply in `ReplyDraft` calls `conversation_reply` with the text on screen;
a host that does not let widgets call tools only offers Copy. Widgets are in
English and German, following the host's language. Other hosts ignore them and
get the same JSON text as before.

## Requirements

- Node.js >= 20
- A FirstReply account, or an organization API key

## Authentication

The hosted server accepts two kinds of bearer token:

- **Sign-in (OAuth 2.1):** hosts such as Claude and ChatGPT only need the
  address `https://mcp.firstreply.ai/`. They register themselves, send the
  user to FirstReply to allow the connection, and act with that user's
  permissions in all of their organizations.
- **Organization API key:** as described below; the only option for the local
  (stdio) server.

With an API key, the server authenticates against the FirstReply REST API with an
**organization API key** (`fr_...`), created in FirstReply under
Organization → Development → API Keys. Organizations support multiple named
keys with optional expiry, so it is best to create a dedicated key for this
MCP server. The key is sent as `Authorization: Bearer`.

API key requests run with the permissions of the organization owner: treat
the key as a secret and rotate it by creating a new key and deleting the old
one.

A key only reaches its own organization: `organization_list` returns just
that organization, and requests for any other organization are refused with
403. To work across several organizations, configure one server per key.

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

## Usage (hosted)

The server runs at `https://mcp.firstreply.ai/` (streamable HTTP). Send the
organization API key as bearer token:

```bash
claude mcp add --transport http firstreply https://mcp.firstreply.ai/ \
  --header "Authorization: Bearer fr_..."
```

## Usage (HTTP)

```bash
npm run build && npm run start:http   # listens on :8080
```

Stateless: every request gets its own server instance, 2026-07-28 requests
are answered directly and 2025-era clients over a stateless streamable-HTTP
transport. Every request must carry `Authorization: Bearer` with an API key or access token. A
`/health` endpoint is provided for probes.

Without a token the answer is 401 with a `WWW-Authenticate` header naming
`/.well-known/oauth-protected-resource`, where the sign-in of an MCP host
starts; `MCP_SERVER_URL` is the address the server names itself with there.

A browser that opens the endpoint (`GET /` with `Accept: text/html`) gets the
landing page from `public/`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `FIRSTREPLY_API_TOKEN` | Organization API key (stdio mode) |
| `FIRSTREPLY_API_URL` | API base URL (default `https://api.firstreply.ai`) |
| `MCP_SERVER_URL` | Public address of the HTTP server, its OAuth resource identifier (default `https://mcp.firstreply.ai`) |
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
├── http-server.ts        # HTTP entry point (Express + createMcpHandler)
├── server.ts             # MCP server factory (McpServer + registerTool)
├── tools.ts              # loads the tool modules, exposes the registry
├── tools/registry.ts     # add() builder, schema helpers, dispatch
├── tools/<resource>.ts   # one module per resource (conversations, contacts, ...)
├── media.ts              # fetches a public file and streams it to a signed upload URL
└── client.ts             # minimal FirstReply REST client
test/
├── tools.test.ts         # tool definition checks and handler tests against a fake client
└── protocol.test.ts      # stdio and HTTP end to end, both protocol eras, against an API stub
```

Adding a tool: call `add(name, description, zodShape, annotations, handler)`
in the matching `src/tools/<resource>.ts`. The zod shape is validated by the
SDK and published to clients as JSON Schema; every argument needs a
description (the tests check).
