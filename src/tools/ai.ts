/**
 * AI: reply drafts, free prompts, translation and the classification test.
 */

import { add, CONVERSATION_ID, optBool, ORG_ID, orgPath, READ, str } from './registry.js';

add(
  'ai_draft_reply',
  'Generate an AI reply draft for a conversation using the organization\'s configured prompts and knowledge base. Returns the draft without sending it.',
  { organizationId: ORG_ID, conversationId: CONVERSATION_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, `/ai/complete/${args.conversationId}`)),
);

add(
  'ai_prompt',
  'Run a free-form prompt through the organization\'s AI: it answers with the organization\'s persona and response rules and, unless disabled, the knowledge base entries matching the prompt. Use it to draft texts or answer questions from the knowledge base. Include any conversation context in the prompt itself.',
  {
    organizationId: ORG_ID,
    prompt: str('The prompt or question.'),
    removeKnowledge: optBool('true answers without searching the knowledge base.'),
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/ai'), {
      prompt: args.prompt,
      removeKnowledge: args.removeKnowledge ?? false,
    }),
);

add(
  'ai_translate',
  'Translate a text into a language, e.g. a reply into the customer\'s language before conversation_reply. The language of the text is detected first: when it already is the target language the text comes back untouched with translated=false. An empty translation means the translation failed.',
  {
    organizationId: ORG_ID,
    text: str('The text to translate.'),
    language: str('Target language as a two-letter code, e.g. the language of the conversation.'),
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/ai/translate'), { text: args.text, language: args.language }),
);

add(
  'ai_test',
  'Simulate an incoming customer message: returns the classification the AI would assign, whether it would be spam, and the reply it would give, without creating a conversation. Useful to check classifications, prompts and knowledge.',
  { organizationId: ORG_ID, message: str('The customer message to test.') },
  READ,
  (client, args) => client.post(orgPath(args.organizationId, '/ai/test'), { message: args.message }),
);
