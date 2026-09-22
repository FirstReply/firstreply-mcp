/**
 * Global search across all entity types.
 */

import { z } from 'zod';
import { add, ORG_ID, orgPath, READ, str } from './registry.js';
import { SEARCH_SYNTAX } from './conversations.js';

add(
  'search',
  `Search conversations, contacts, knowledge entries and messages of an organization in one call. Returns the top matches per type with the total count per type. ${SEARCH_SYNTAX}`,
  {
    organizationId: ORG_ID,
    query: str('Search text, at least 2 characters.'),
    limit: z.number().int().min(1).max(20).describe('Results per type (default 5, max 20).').optional(),
  },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/search'), { q: args.query, limit: args.limit }),
);
