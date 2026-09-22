/**
 * Reply templates.
 */

import { add, DESTRUCTIVE, LIMIT, optBool, optStr, ORG_ID, orgPath, PAGE, paging, READ, str, WRITE } from './registry.js';

const TEMPLATE_ID = str('The template id (see template_list).');

const templatePath = (organizationId: string, templateId: string): string =>
  orgPath(organizationId, `/templates/${templateId}`);

add(
  'template_list',
  'List or search the reply templates of an organization. A template can have language variants that reference it as parent.',
  {
    organizationId: ORG_ID,
    search: optStr('Matches the template name and text.'),
    hasParentId: optBool('true lists only language variants, false only top-level templates.'),
    page: PAGE,
    limit: LIMIT,
  },
  READ,
  (client, args) =>
    client.post(orgPath(args.organizationId, '/templates/search'), {
      search: args.search,
      hasParentId: args.hasParentId,
      ...paging(args),
    }),
);

add(
  'template_get',
  'Get one reply template by id, with its plain text and HTML.',
  { organizationId: ORG_ID, templateId: TEMPLATE_ID },
  READ,
  (client, args) => client.get(templatePath(args.organizationId, args.templateId)),
);

add(
  'template_create',
  'Create a reply template.',
  {
    organizationId: ORG_ID,
    name: str('Name of the template.'),
    plain: str('Plain text of the template.'),
    html: optStr('HTML version of the template; defaults to the plain text.'),
    language: optStr('Two-letter language code of the text.'),
    parentId: optStr('Id of the template this one is a language variant of.'),
  },
  WRITE,
  (client, { organizationId, ...fields }) =>
    client.post(orgPath(organizationId, '/templates'), { ...fields, html: fields.html ?? fields.plain }),
);

add(
  'template_update',
  'Update a reply template. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    templateId: TEMPLATE_ID,
    name: optStr('New name.'),
    plain: optStr('New plain text.'),
    html: optStr('New HTML; defaults to the new plain text when only that is given.'),
    language: optStr('Two-letter language code of the text.'),
    parentId: optStr('Id of the template this one is a language variant of.'),
  },
  WRITE,
  (client, { organizationId, templateId, ...fields }) =>
    client.put(templatePath(organizationId, templateId), {
      ...fields,
      html: fields.html ?? fields.plain,
    }),
);

add(
  'template_delete',
  'Delete a reply template permanently.',
  { organizationId: ORG_ID, templateId: TEMPLATE_ID },
  DESTRUCTIVE,
  async (client, args) => {
    await client.delete(templatePath(args.organizationId, args.templateId));
    return { success: true, message: 'Template deleted.' };
  },
);
