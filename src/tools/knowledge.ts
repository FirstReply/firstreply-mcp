/**
 * Knowledge base entries and the synced knowledge sources.
 */

import {
  add,
  DESTRUCTIVE,
  idList,
  LIMIT,
  optBool,
  optStr,
  ORG_ID,
  orgPath,
  PAGE,
  paging,
  READ,
  str,
  WRITE,
} from './registry.js';

const KNOWLEDGE_ID = str('The knowledge entry id.');
const SOURCE_ID = str('The knowledge source id (see knowledge_source_list).');

const knowledgePath = (organizationId: string, knowledgeId: string): string =>
  orgPath(organizationId, `/knowledge/${knowledgeId}`);
const sourcePath = (organizationId: string, sourceId: string, suffix = ''): string =>
  orgPath(organizationId, `/knowledge-sources/${sourceId}${suffix}`);

/** Knowledge source configurations hold credentials; never hand them to the model. */
function withoutConfiguration(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutConfiguration);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'configuration') continue;
      out[key] = withoutConfiguration(entry);
    }
    return out;
  }
  return value;
}

add(
  'knowledge_search',
  'Search the knowledge base of an organization (full text: words are AND-ed and prefix matched, "quoted phrases", -word to exclude). Omit search to browse all entries. Entries are question / answer pairs (prompt / completion); synced articles are split into chunks that share a source.',
  {
    organizationId: ORG_ID,
    search: optStr('Search text.'),
    classificationId: optStr('Only entries of this classification.'),
    sourceId: optStr('Only entries synced from this knowledge source.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/knowledge/search'), {
      search: args.search,
      classificationIds: idList(args.classificationId),
      sourceId: args.sourceId,
      ...paging(args),
    }),
);

add(
  'knowledge_get',
  'Get one knowledge entry by id.',
  { organizationId: ORG_ID, knowledgeId: KNOWLEDGE_ID },
  READ,
  (client, args) => client.get(knowledgePath(args.organizationId, args.knowledgeId)),
);

add(
  'knowledge_create',
  'Add a knowledge entry the AI can use for replies: a question or topic and its answer.',
  {
    organizationId: ORG_ID,
    prompt: str('The question, topic or title.'),
    completion: str('The answer or article text.'),
    classificationId: optStr('Classification this entry belongs to (see classification_list).'),
    positive: optBool('false marks the entry as a negative example (default true).'),
  },
  WRITE,
  (client, { organizationId, ...fields }) =>
    client.post(orgPath(organizationId, '/knowledge'), { ...fields, positive: fields.positive ?? true }),
);

add(
  'knowledge_update',
  'Update a knowledge entry. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    knowledgeId: KNOWLEDGE_ID,
    prompt: optStr('New question, topic or title.'),
    completion: optStr('New answer or article text.'),
    classificationId: optStr('New classification id.'),
    positive: optBool('false marks the entry as a negative example.'),
  },
  WRITE,
  async (client, { organizationId, knowledgeId, ...fields }) => {
    const path = knowledgePath(organizationId, knowledgeId);
    // The update DTO carries a primitive flag that would otherwise reset, so send the current value along.
    const current = (await client.get(path)) as { positive: boolean };
    return client.put(path, { ...fields, positive: fields.positive ?? current.positive });
  },
);

add(
  'knowledge_delete',
  'Delete a knowledge entry permanently.',
  { organizationId: ORG_ID, knowledgeId: KNOWLEDGE_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(knowledgePath(args.organizationId, args.knowledgeId));
    return { success: true, message: 'Knowledge entry deleted.' };
  },
);

// ---------------------------------------------------------------------------
// Knowledge sources
// ---------------------------------------------------------------------------

add(
  'knowledge_source_list',
  'List the knowledge sources of an organization (websites, GitHub, Notion, GitBook, ...) with their sync state, last sync time, last error and number of synced entries.',
  { organizationId: ORG_ID },
  READ,
  async (client, args) =>
    withoutConfiguration(await client.get(orgPath(args.organizationId, '/knowledge-sources'), { page: 1, limit: 50 })),
);

add(
  'knowledge_source_get',
  'Get one knowledge source by id.',
  { organizationId: ORG_ID, sourceId: SOURCE_ID },
  READ,
  async (client, args) => withoutConfiguration(await client.get(sourcePath(args.organizationId, args.sourceId))),
);

add(
  'knowledge_source_sync',
  'Start a sync of a knowledge source now. Runs in the background; check knowledge_source_status for the result.',
  { organizationId: ORG_ID, sourceId: SOURCE_ID },
  WRITE,
  async (client, args) => withoutConfiguration(await client.post(sourcePath(args.organizationId, args.sourceId, '/sync'))),
);

add(
  'knowledge_source_status',
  'Sync status of a knowledge source: state (PENDING, SYNCING, SUCCESS, ERROR), last sync time, last error, entry count.',
  { organizationId: ORG_ID, sourceId: SOURCE_ID },
  READ,
  async (client, args) =>
    withoutConfiguration(await client.get(sourcePath(args.organizationId, args.sourceId, '/status'))),
);
