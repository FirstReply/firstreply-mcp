/**
 * Saved AI prompts.
 */

import { add, DESTRUCTIVE, LIMIT, optStr, ORG_ID, orgPath, PAGE, paging, READ, str, WRITE } from './registry.js';

const PROMPT_ID = str('The prompt id (see prompt_list).');

const promptPath = (organizationId: string, promptId: string): string => orgPath(organizationId, `/prompts/${promptId}`);

add(
  'prompt_list',
  'List or search the saved AI prompts of an organization. Classifications reference a prompt for their AI replies, and ai_prompt can apply one.',
  {
    organizationId: ORG_ID,
    search: optStr('Matches the prompt name and text.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/prompts/search'), { search: args.search, ...paging(args) }),
);

add(
  'prompt_get',
  'Get one saved prompt by id.',
  { organizationId: ORG_ID, promptId: PROMPT_ID },
  READ,
  (client, args) => client.get(promptPath(args.organizationId, args.promptId)),
);

add(
  'prompt_create',
  'Create a saved AI prompt.',
  {
    organizationId: ORG_ID,
    name: str('Name of the prompt.'),
    text: str('The prompt text (instructions for the AI).'),
  },
  WRITE,
  (client, { organizationId, ...fields }) => client.post(orgPath(organizationId, '/prompts'), fields),
);

add(
  'prompt_update',
  'Update a saved prompt. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    promptId: PROMPT_ID,
    name: optStr('New name.'),
    text: optStr('New prompt text.'),
  },
  WRITE,
  (client, { organizationId, promptId, ...fields }) => client.put(promptPath(organizationId, promptId), fields),
);

add(
  'prompt_delete',
  'Delete a saved prompt permanently.',
  { organizationId: ORG_ID, promptId: PROMPT_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(promptPath(args.organizationId, args.promptId));
    return { success: true, message: 'Prompt deleted.' };
  },
);
