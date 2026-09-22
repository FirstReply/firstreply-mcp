/**
 * Classifications: the categories conversations are sorted into, with their
 * automation settings.
 */

import { add, DESTRUCTIVE, optBool, optNum, optStr, ORG_ID, orgPath, READ, str, WRITE } from './registry.js';

const CLASSIFICATION_ID = str('The classification id (see classification_list).');

const SETTINGS = {
  description: optStr('What kind of conversations belong here; the AI uses it to classify incoming messages.'),
  color: optNum('Color index shown in the app.'),
  aiReply: optBool('true lets the AI answer conversations of this classification automatically.'),
  aiReplyDraft: optBool('true makes the AI prepare a draft for the team instead of sending its reply.'),
  sentimentAnalysis: optBool('true enables sentiment analysis for these conversations.'),
  autoClose: optBool('true closes a conversation automatically after the AI replied.'),
  defaultMemberId: optStr('Member id these conversations are assigned to by default (see member_list).'),
  promptId: optStr('Prompt id the AI uses for replies here (see prompt_list).'),
  templateId: optStr('Template id used for replies here (see template_list).'),
};

type Settings = {
  name: string;
  description?: string;
  color: number;
  aiReply: boolean;
  aiReplyDraft: boolean;
  sentimentAnalysis: boolean;
  autoClose: boolean;
  defaultMemberId?: string;
  promptId?: string;
  templateId?: string;
};

const classificationPath = (organizationId: string, classificationId: string, suffix = ''): string =>
  orgPath(organizationId, `/classifications/${classificationId}${suffix}`);

add(
  'classification_list',
  'List the classifications of an organization with their automation settings (AI reply, draft, auto close, default assignee, prompt, template).',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/classifications'), { page: 1, limit: 50 }),
);

add(
  'classification_get',
  'Get one classification by id.',
  { organizationId: ORG_ID, classificationId: CLASSIFICATION_ID },
  READ,
  (client, args) => client.get(classificationPath(args.organizationId, args.classificationId)),
);

add(
  'classification_create',
  'Create a classification.',
  {
    organizationId: ORG_ID,
    name: str('Name of the classification.'),
    ...SETTINGS,
  },
  WRITE,
  (client, { organizationId, ...fields }) =>
    client.post(orgPath(organizationId, '/classifications'), {
      ...fields,
      color: fields.color ?? 0,
      aiReply: fields.aiReply ?? false,
      aiReplyDraft: fields.aiReplyDraft ?? false,
      sentimentAnalysis: fields.sentimentAnalysis ?? false,
      autoClose: fields.autoClose ?? false,
    }),
);

add(
  'classification_update',
  'Update a classification. Only provide fields to change.',
  {
    organizationId: ORG_ID,
    classificationId: CLASSIFICATION_ID,
    name: optStr('New name.'),
    ...SETTINGS,
  },
  WRITE,
  async (client, { organizationId, classificationId, ...fields }) => {
    const path = classificationPath(organizationId, classificationId);
    // The update DTO carries primitive flags that would otherwise reset, so merge with the current values.
    const current = (await client.get(path)) as Settings;
    return client.put(path, {
      name: fields.name ?? current.name,
      description: fields.description ?? current.description,
      color: fields.color ?? current.color,
      aiReply: fields.aiReply ?? current.aiReply,
      aiReplyDraft: fields.aiReplyDraft ?? current.aiReplyDraft,
      sentimentAnalysis: fields.sentimentAnalysis ?? current.sentimentAnalysis,
      autoClose: fields.autoClose ?? current.autoClose,
      defaultMemberId: fields.defaultMemberId ?? current.defaultMemberId,
      promptId: fields.promptId ?? current.promptId,
      templateId: fields.templateId ?? current.templateId,
    });
  },
);

add(
  'classification_delete',
  'Delete a classification. Conversations that use it are moved to reassignTo or left unclassified. Use classification_impact first to see how many conversations and knowledge entries are affected.',
  {
    organizationId: ORG_ID,
    classificationId: CLASSIFICATION_ID,
    reassignTo: optStr('Classification id that affected conversations are moved to.'),
  },
  DESTRUCTIVE,
  async (client, args) => {
    const query = args.reassignTo ? `?reassignTo=${encodeURIComponent(args.reassignTo)}` : '';
    await client.delete(classificationPath(args.organizationId, args.classificationId) + query);
    return { success: true, message: 'Classification deleted.' };
  },
);

add(
  'classification_impact',
  'Preview what deleting a classification would affect (conversations, knowledge entries).',
  { organizationId: ORG_ID, classificationId: CLASSIFICATION_ID },
  READ,
  (client, args) => client.get(classificationPath(args.organizationId, args.classificationId, '/impact')),
);

add(
  'classification_statistics',
  'How many conversations fall into each classification of an organization.',
  { organizationId: ORG_ID },
  READ,
  (client, args) => client.get(orgPath(args.organizationId, '/classifications/statistics')),
);
