# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Organization tools: `organization_get`, `organization_update`,
  `organization_usage`, `member_get`, `member_create`, `member_update`,
  `member_delete`.
- Inbox tools: `inbox_get`, `inbox_statistics`, `inbox_refresh`, `inbox_test`.
- Conversation tools: `conversation_thread`, `conversation_read`,
  `conversation_spam`, `conversation_delete`, `conversation_stats_by_member`,
  `conversation_metrics`.
- Message tools: `message_get`, `message_update`, `message_send`,
  `message_delete`.
- Contact tools: `contact_list`, `contact_get`, `contact_create`,
  `contact_update`, `contact_delete`, `contact_field_list`.
- Classification tools: `classification_list`, `classification_get`,
  `classification_create`, `classification_update`, `classification_delete`,
  `classification_impact`, `classification_statistics`.
- Knowledge tools: `knowledge_search`, `knowledge_get`, `knowledge_create`,
  `knowledge_update`, `knowledge_delete`, `knowledge_source_list`,
  `knowledge_source_get`, `knowledge_source_sync`, `knowledge_source_status`.
  Knowledge source configurations (credentials) are stripped from results.
- AI tools: `ai_prompt`, `ai_translate`, `ai_test`.
- Global `search` across conversations, contacts, knowledge and messages.
- Template, prompt, webhook and saved filter tools (list, get, create, update,
  delete; `webhook_test`, `webhook_rotate_secret`).

### Changed

- `conversation_list` gained the contact, classification, language, spam and
  date range filters, documents the search operators and lets the API rank
  search results by relevance.
- `conversation_update` can also change subject, language, contact and the
  spam flag.
- `conversation_reply` can store an internal note or a draft instead of
  sending, and carries the `language` / `translation` fields of a translated
  reply.
- `conversation_messages` accepts a search text.
- `inbox_list` lists all supported channels, including App Store and website
  chat.
- Tool arguments are declared as zod schemas and validated by the SDK; the
  server uses `McpServer.registerTool` instead of the deprecated low-level
  `Server` API. Tool modules live under `src/tools/`.
- The server version is read from `package.json`.

### Fixed

- `bin`, `main` and the start scripts pointed at `dist/index.js` while the
  build emits `dist/src/index.js`, so `npx @firstreply/mcp` could not start.

## [0.1.0] - 2026-07-19

### Added

- Initial release: MCP server (stdio and streamable-HTTP transports) exposing
  FirstReply customer support operations as tools.
- Organization tools: `organization_list`, `inbox_list`, `member_list`.
- API key management tools: `api_key_list`, `api_key_create` (shown-once
  plaintext), `api_key_delete`.
- Conversation tools: `conversation_list`, `conversation_get`,
  `conversation_messages`, `conversation_reply`, `conversation_close`,
  `conversation_update`, `conversation_stats`, `conversation_totals`.
- AI tools: `ai_draft_reply`.
