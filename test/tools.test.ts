import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS, dispatchTool } from '../src/tools.js';
import { FirstReplyClient } from '../src/client.js';

test('tool names are unique and snake_case', () => {
  const names = TOOL_DEFINITIONS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length, 'duplicate tool names');
  for (const name of names) {
    assert.match(name, /^[a-z][a-z0-9_]*$/, `invalid tool name: ${name}`);
  }
});

test('every tool has description, schema and annotations', () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.ok(tool.description.length > 20, `${tool.name}: description too short`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.title.length > 0);
    assert.equal(typeof tool.annotations.readOnlyHint, 'boolean');
  }
});

test('required properties exist in the schema', () => {
  for (const tool of TOOL_DEFINITIONS) {
    for (const required of tool.inputSchema.required ?? []) {
      assert.ok(
        tool.inputSchema.properties[required],
        `${tool.name}: required property ${required} not declared`,
      );
    }
  }
});

test('org-scoped tools require organizationId', () => {
  for (const tool of TOOL_DEFINITIONS) {
    if (tool.inputSchema.properties.organizationId) {
      assert.ok(
        (tool.inputSchema.required ?? []).includes('organizationId'),
        `${tool.name}: organizationId must be required`,
      );
    }
  }
});

test('destructive reply tool is annotated as destructive', () => {
  const reply = TOOL_DEFINITIONS.find((tool) => tool.name === 'conversation_reply');
  assert.ok(reply);
  assert.equal(reply.annotations.destructiveHint, true);
  assert.equal(reply.annotations.readOnlyHint, false);
});

test('dispatchTool returns null for unknown tools', async () => {
  const client = new FirstReplyClient('fr_test');
  assert.equal(await dispatchTool(client, 'does_not_exist', {}), null);
});

test('missing required argument produces a helpful error', async () => {
  const client = new FirstReplyClient('fr_test');
  await assert.rejects(
    dispatchTool(client, 'inbox_list', {}),
    /Missing required argument: organizationId/,
  );
});
