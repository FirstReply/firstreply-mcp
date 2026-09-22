/**
 * Contacts (customers) and the custom contact fields.
 */

import { z } from 'zod';
import { add, DESTRUCTIVE, LIMIT, optBool, optStr, ORG_ID, orgPath, PAGE, paging, READ, str, WRITE } from './registry.js';

const CONTACT_ID = str('The contact id (see contact_list or the contactId of a conversation).');

const FIELDS = z
  .array(
    z.object({
      key: str('Key of a custom contact field (see contact_field_list).'),
      value: str('Value to store.'),
    }),
  )
  .describe('Custom field values. Fields not listed keep their value.')
  .optional();

const contactPath = (organizationId: string, contactId: string): string =>
  orgPath(organizationId, `/contacts/${contactId}`);

add(
  'contact_list',
  'List or search the contacts (customers) of an organization: name, email, phone, messaging ids, custom fields and conversation count.',
  {
    organizationId: ORG_ID,
    search: optStr('Matches name, email and phone.'),
    senderOnly: optBool('true lists only contacts who have written to the organization.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/contacts/search'), {
      search: args.search,
      senderOnly: args.senderOnly ?? false,
      ...paging(args),
    }),
);

add(
  'contact_get',
  'Get one contact by id, including custom field values and the number of conversations.',
  { organizationId: ORG_ID, contactId: CONTACT_ID },
  READ,
  (client, args) => client.get(contactPath(args.organizationId, args.contactId)),
);

add(
  'contact_create',
  'Create a contact. Provide at least a name or an email address.',
  {
    organizationId: ORG_ID,
    firstname: optStr('First name.'),
    lastname: optStr('Last name.'),
    name: optStr('Display name, when first and last name are not known separately.'),
    email: optStr('Email address.'),
    phone: optStr('Phone number.'),
    description: optStr('Free text notes about the contact.'),
    fields: FIELDS,
  },
  WRITE,
  (client, { organizationId, ...fields }) => client.post(orgPath(organizationId, '/contacts'), fields),
);

add(
  'contact_update',
  'Update a contact. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    contactId: CONTACT_ID,
    firstname: optStr('First name.'),
    lastname: optStr('Last name.'),
    name: optStr('Display name.'),
    email: optStr('Email address.'),
    phone: optStr('Phone number.'),
    description: optStr('Free text notes about the contact.'),
    fields: FIELDS,
  },
  WRITE,
  (client, { organizationId, contactId, ...fields }) => client.put(contactPath(organizationId, contactId), fields),
);

add(
  'contact_delete',
  'Delete a contact permanently.',
  { organizationId: ORG_ID, contactId: CONTACT_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(contactPath(args.organizationId, args.contactId));
    return { success: true, message: 'Contact deleted.' };
  },
);

add(
  'contact_field_list',
  'List the custom contact fields defined in an organization (key, name, type: 0 = text, 1 = link, 2 = button). Use the keys with contact_create and contact_update.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/contactfields'), { page: 1, limit: 50 }),
);
