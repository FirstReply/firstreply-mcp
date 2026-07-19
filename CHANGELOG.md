# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
