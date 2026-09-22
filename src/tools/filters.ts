/**
 * Saved conversation filters (the views in the inbox sidebar).
 */

import {
  add,
  DESTRUCTIVE,
  epochMillis,
  optDate,
  optEnum,
  optNum,
  optStr,
  optStrList,
  ORG_ID,
  orgPath,
  READ,
  str,
  WRITE,
} from './registry.js';
import { SEARCH_SYNTAX } from './conversations.js';

const FILTER_ID = str('The filter id (see filter_list).');

const CRITERIA = {
  inboxIds: optStrList('Inbox ids.'),
  classificationIds: optStrList('Classification ids.'),
  memberIds: optStrList('Assigned member ids.'),
  status: optEnum(['unread', 'read', 'open', 'closed'], 'Status; "open" is unread + read.'),
  contactId: optStr('Contact id.'),
  priority: optNum('Exact priority.'),
  search: optStr(`Search text. ${SEARCH_SYNTAX}`),
  createdAfter: optDate('Created at or after.'),
  createdBefore: optDate('Created at or before.'),
  updatedAfter: optDate('Updated at or after.'),
  updatedBefore: optDate('Updated at or before.'),
};

interface Criteria {
  inboxIds?: string[];
  classificationIds?: string[];
  memberIds?: string[];
  status?: string;
  contactId?: string;
  priority?: number;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

interface FilterBody {
  inboxIds?: string[];
  classificationIds?: string[];
  memberIds?: string[];
  status?: string;
  contactId?: string;
  priority?: number;
  search?: string;
  createdFrom?: number;
  createdTo?: number;
  lastUpdateFrom?: number;
  lastUpdateTo?: number;
}

function toFilter(criteria: Criteria): FilterBody {
  return {
    inboxIds: criteria.inboxIds,
    classificationIds: criteria.classificationIds,
    memberIds: criteria.memberIds,
    status: criteria.status,
    contactId: criteria.contactId,
    priority: criteria.priority,
    search: criteria.search,
    createdFrom: epochMillis(criteria.createdAfter),
    createdTo: epochMillis(criteria.createdBefore),
    lastUpdateFrom: epochMillis(criteria.updatedAfter),
    lastUpdateTo: epochMillis(criteria.updatedBefore),
  };
}

const filterPath = (organizationId: string, filterId: string): string => orgPath(organizationId, `/filters/${filterId}`);

add(
  'filter_list',
  'List the saved conversation filters of the authenticated user in an organization, with their criteria and conversation counts.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/filters'), { page: 1, limit: 50 }),
);

add(
  'filter_get',
  'Get one saved conversation filter by id.',
  { organizationId: ORG_ID, filterId: FILTER_ID },
  READ,
  (client, args) => client.get(filterPath(args.organizationId, args.filterId)),
);

add(
  'filter_create',
  'Save a conversation filter (a named view in the inbox). All criteria are optional and combine.',
  {
    organizationId: ORG_ID,
    name: str('Name of the filter.'),
    color: optNum('Color index shown in the app.'),
    ...CRITERIA,
  },
  WRITE,
  (client, { organizationId, name, color, ...criteria }) =>
    client.post(orgPath(organizationId, '/filters'), {
      name,
      color: color ?? 0,
      filter: { ...toFilter(criteria), priority: criteria.priority ?? -1 },
    }),
);

add(
  'filter_update',
  'Update a saved conversation filter. Only provide fields to change; criteria not given keep their value.',
  {
    organizationId: ORG_ID,
    filterId: FILTER_ID,
    name: optStr('New name.'),
    color: optNum('Color index shown in the app.'),
    ...CRITERIA,
  },
  WRITE,
  async (client, { organizationId, filterId, name, color, ...criteria }) => {
    const path = filterPath(organizationId, filterId);
    // The update DTO carries primitive fields that would otherwise reset, so merge with the current values.
    const current = (await client.get(path)) as { name: string; color: number; arrangement: number; filter?: FilterBody };
    const changes = toFilter(criteria);
    const filter: Record<string, unknown> = { ...(current.filter ?? {}) };
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) filter[key] = value;
    }
    return client.put(path, {
      name: name ?? current.name,
      color: color ?? current.color,
      arrangement: current.arrangement,
      filter,
    });
  },
);

add(
  'filter_delete',
  'Delete a saved conversation filter.',
  { organizationId: ORG_ID, filterId: FILTER_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(filterPath(args.organizationId, args.filterId));
    return { success: true, message: 'Filter deleted.' };
  },
);
