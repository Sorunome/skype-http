import { Incident } from 'incident';
import cheerio from 'cheerio';
import { map } from 'lodash';
import { ParsedConversationId } from '../interfaces/api/api';
import { Contact } from '../interfaces/api/contact';
import { Conversation, ThreadProperties } from '../interfaces/api/conversation';
import * as events from '../interfaces/api/events';
import * as resources from '../interfaces/api/resources';

import { Contact as NativeContact, SearchContact as NativeSearchContact } from '../interfaces/native-api/contact';
import {
  Conversation as NativeConversation,
  Thread as NativeThread,
  ThreadMember as NativeThreadMember,
} from '../interfaces/native-api/conversation';
import * as nativeEvents from '../interfaces/native-api/events';
import * as nativeMessageResources from '../interfaces/native-api/message-resources';
import * as nativeResources from '../interfaces/native-api/resources';
import { MriType, MriTypeCode, mriTypeFromTypeName, MriTypeName, mriTypeToTypeCode, mriTypeToTypeName } from '../mri';
import * as messagesUri from '../messages-uri';
import { sanitizeXml } from './user-data-processor';

export function formatConversation(native: NativeConversation): Conversation {
  // TODO: parse id
  if (native.id.indexOf('19:') === 0) {
    // thread
    return native;
  } else {
    // private
    const contact: string = native.id;
    const result: Conversation = native;
    result.members = [contact];
    return result;
  }
}

export function formatThread(native: NativeThread): Conversation {
  const memberIds: string[] = map(native.members, (member: NativeThreadMember): string => member.id);
  const properties: ThreadProperties = {};

  if ('properties' in native) {
    if ('topic' in native.properties) {
      properties.topic = native.properties.topic;
    }
    if ('lastjoinat' in native.properties) {
      properties.topic = native.properties.lastjoinat;
    }
    if ('version' in native.properties) {
      properties.topic = native.properties.version;
    }
  }

  return {
    threadProperties: properties,
    id: native.id,
    type: native.type,
    version: native.version,
    members: memberIds,
  };
}

export function formatSearchContact(native: NativeSearchContact): Contact {
  return searchContactToPerson(native);
}

export function formatContact(native: NativeContact): Contact {
  return contactToPerson(native);
}

// github:demurgos/skype-web-reversed -> jSkype/modelHelpers/contacts/dataMappers/agentToPerson.js
// function agentToPerson(native: any): any {}

// TODO: check that the uri uses the HTTPS protocol
function ensureHttps(uri: string) {
  return uri;
}

// function define(...args: any[]) {
//   return null;
// }

function searchContactToPerson(native: NativeSearchContact): Contact {
  let avatarUrl: string | null;
  if (typeof native.avatarUrl === 'string') {
    avatarUrl = ensureHttps(native.avatarUrl);
    // TODO: ensure that the "cacheHeaders=1" queryString is there
  } else {
    avatarUrl = null;
  }
  const workloads: string | null = native.workloads;
  const displayName: string = sanitizeXml(native.displayname);
  const firstName: string | null = native.firstname !== undefined ? sanitizeXml(native.firstname) : null;
  const lastName: string | null = native.lastname !== undefined ? sanitizeXml(native.lastname) : null;

  const phoneNumbers: any[] = [];
  const locations: any[] = [];
  const type: MriType = MriType.Skype;
  const typeKey: MriTypeCode = mriTypeToTypeCode(type);
  return {
    id: {
      id: native.username,
      typeKey,
      typeName: mriTypeToTypeName(type),
      raw: `${typeKey}:${native.username}`,
    },
    workloads,
    emails: native.emails,
    avatarUrl,
    phones: phoneNumbers,
    name: {
      first: firstName,
      surname: lastName,
      nickname: native.username,
      displayName,
    },
    activityMessage: native.mood,
    locations,
  };
}

// github:demurgos/skype-web-reversed -> jSkype/modelHelpers/contacts/dataMappers/contactToPerson.js
function contactToPerson(native: NativeContact): Contact {
  const SUGGESTED_CONTACT_ACTIVITY_MESSAGE = 'Skype';

  // TODO(demurgos): typedef
  // const authorizationStates = {
  //   UNKNOWN: 'UNKNOWN',
  //   UNAUTHORIZED: 'UNAUTHORIZED',
  //   PENDING_OUTGOING: 'PENDING_OUTGOING',
  //   PENDING_INCOMING: 'PENDING_INCOMING',
  //   AUTHORIZED: 'AUTHORIZED',
  //   SUGGESTED: 'SUGGESTED',
  // };

  // TODO(demurgos): typedef
  // const showStrategies = {
  //   ALL: 'ALL',
  //   AVAILABLE_ONLY: 'AVAILABLE_ONLY',
  //   AGENTS_ONLY: 'AGENTS_ONLY',
  // };

  let activityMessage: string | null;
  if (native.suggested) {
    activityMessage = SUGGESTED_CONTACT_ACTIVITY_MESSAGE;
  } else {
    activityMessage = native.mood === undefined ? null : native.mood;
  }

  // let capabilities: string[];
  // if (native.type === 'agent') {
  //   capabilities = native.agent.capabilities;
  // } else if (native.type === 'pstn') {
  //   capabilities = ['audio.receive', 'group.add'];
  // } else {
  //   capabilities = [];
  // }
  //
  // let authorizationState: string;
  // if (native.authorized) {
  //   authorizationState = authorizationStates.AUTHORIZED;
  // } else if (native.suggested) {
  //   authorizationState = authorizationStates.SUGGESTED;
  // } else {
  //   authorizationState = authorizationStates.PENDING_OUTGOING;
  // }

  // We can safely cast here because `mriTypeFromTypeName` tests the validity of the name.
  const type: MriType = mriTypeFromTypeName(native.type as MriTypeName);
  const typeKey: MriTypeCode = mriTypeToTypeCode(type);
  // const isAgent: boolean = native.type === 'agent';

  let avatarUrl: string | null;

  if (typeof native.avatar_url === 'string') {
    avatarUrl = ensureHttps(native.avatar_url);
    // TODO: ensure that the "cacheHeaders=1" queryString is there
  } else {
    avatarUrl = null;
  }
  const workloads: string | null = native.workloads;

  const displayName: string = sanitizeXml(native.display_name);
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (native.name !== undefined && native.name.first !== undefined) {
    firstName = sanitizeXml(native.name.first);
  }
  if (native.name !== undefined && native.name.surname !== undefined) {
    lastName = sanitizeXml(native.name.surname);
  }

  const phoneNumbers: any[] = [];
  const locations: any[] = [];

  return {
    id: {
      id: native.id,
      typeKey,
      typeName: native.type,
      raw: `${typeKey}:${native.id}`,
    },
    workloads,
    avatarUrl,
    phones: phoneNumbers,
    name: {
      first: firstName,
      surname: lastName,
      nickname: native.id,
      displayName,
    },
    activityMessage,
    locations,
  };
}

// github:demurgos/skype-web-reversed -> jSkype/modelHelpers/contacts/dataMappers/dataMaps.js
// function phoneTypeNameToPhoneTypeKey(typeName: string) {
//   switch (typeName) {
//     case 'Home':
//       return '0';
//     case 'Work':
//       return '1';
//     case 'Cell':
//       return '2';
//     case 'Other':
//       return '3';
//     default:
//       throw new Incident('unknown-phone-type-name', { typeName }, `Unknwon phone type name ${typeName}`);
//   }
// }

// github:demurgos/skype-web-reversed -> jSkype/modelHelpers/contacts/dataMappers/dataMaps.js
// function phoneTypeKeyToPhoneTypeName(typeKey: string) {
//   switch (typeKey) {
//     case '0':
//       return 'Home';
//     case '1':
//       return 'Work';
//     case '2':
//       return 'Cell';
//     case '3':
//       return 'Other';
//     default:
//       throw new Incident('unknown-phone-type-key', { typeCode: typeKey }, `Unknwon phone type key ${typeKey}`);
//   }
// }

// let lastMsgId = 0; // this is used to make the next poll request
// let notifUri: string;

// Match a contact id:
// TODO: handle the "guest" prefix
const CONTACT_ID_PATTERN = /^(\d+):(.+)$/;

// TODO(demurgos): Looks like there is a problem with the return type
export function parseContactId(contactId: string): ParsedConversationId {
  const match: RegExpExecArray | null = CONTACT_ID_PATTERN.exec(contactId);
  if (match === null) {
    throw new Incident('parse-error', 'Unable to parse userId');
  }
  return {
    raw: contactId,
    prefix: parseInt(match[1], 10),
    username: match[2],
  };
}

export function formatRichTextResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.RichText,
): resources.RichTextResource {
  const ret: resources.RichTextResource = retObj as resources.RichTextResource;
  ret.content = nativeResource.content;
  ret.clientId = nativeResource.clientmessageid;
  return ret;
}

export function formatTextResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.Text,
): resources.TextResource {
  const ret: resources.TextResource = retObj as resources.TextResource;
  ret.content = nativeResource.content;
  ret.clientId = nativeResource.clientmessageid;
  ret.properties = nativeResource.properties;
  const propsObj: any = nativeResource.properties;
  ret.callLog = propsObj ? JSON.parse(propsObj['call-log']) : {};
  return ret;
}

export function formatControlClearTypingResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.ControlClearTyping,
): resources.ControlClearTypingResource {
  return retObj as resources.ControlClearTypingResource;
}

interface FormattedMessageResource {
  type: resources.ResourceType;
  id: string;
  composeTime: Date;
  arrivalTime: Date;
  from: ParsedConversationId;
  conversation: string;
  native: nativeResources.MessageResource;
}

// Export for testing
export function formatGenericMessageResource(
  nativeResource: nativeResources.MessageResource,
  type: resources.ResourceType,
): FormattedMessageResource {
  const parsedConversationUri: messagesUri.ConversationUri = messagesUri.parseConversation(
    nativeResource.conversationLink,
  );
  const parsedContactUri: messagesUri.ContactUri = messagesUri.parseContact(nativeResource.from);
  const parsedContactId: ParsedConversationId = parseContactId(parsedContactUri.contact);
  return {
    type,
    id: nativeResource.id,
    composeTime: new Date(nativeResource.composetime),
    arrivalTime: new Date(nativeResource.originalarrivaltime),
    from: parsedContactId,
    conversation: parsedConversationUri.conversation,
    native: nativeResource,
  };
}

// tslint:disable-next-line:max-line-length
export function formatConversationUpdateResource(
  nativeResource: nativeResources.ConversationUpdate,
): resources.ConversationUpdateResource {
  // dummy links needed in order to avoid errors caused when users aren't yet connected
  const parsedConversationUri: messagesUri.ConversationUri = messagesUri.parseConversation(
    nativeResource.lastMessage.conversationLink !== undefined
      ? nativeResource.lastMessage.conversationLink
      : 'https://client-s.gateway.messenger.live.com/v1/users/ME/conversations/8:dummy_user',
  );

  const parsedContactUri: messagesUri.ContactUri = messagesUri.parseContact(
    nativeResource.lastMessage.from !== undefined
      ? nativeResource.lastMessage.from
      : 'https://client-s.gateway.messenger.live.com/v1/users/ME/contacts/8:dummy_user',
  );

  const parsedContactId: ParsedConversationId = parseContactId(parsedContactUri.contact);
  return {
    type: 'ConversationUpdate',
    id: nativeResource.id,
    clientId: nativeResource.lastMessage.clientmessageid,
    composeTime: new Date(nativeResource.lastMessage.composetime),
    arrivalTime: new Date(nativeResource.lastMessage.originalarrivaltime),
    from: parsedContactId,
    conversation: parsedConversationUri.conversation,
    native: nativeResource,
    content: nativeResource.lastMessage.content,
  };
}

export function formatCustomUserPropertiesResource(
  nativeResource: nativeResources.CustomUserPropertiesResource,
): resources.CustomUserPropertiesResource {
  return {
    type: 'CustomUserProperties',
    id: nativeResource.id,
    composeTime: new Date(),
    arrivalTime: new Date(),
    conversation: '',
    from: { raw: '', prefix: 0, username: '' },
    native: nativeResource,
    time: nativeResource.time,
    resourceLink: nativeResource.resourceLink,
    resource: nativeResource.resource,
  };
}

// tslint:disable-next-line:max-line-length
export function formatControlTypingResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.ControlTyping,
): resources.ControlTypingResource {
  const ret: resources.ControlTypingResource = retObj as resources.ControlTypingResource;
  return ret;
}

// tslint:disable-next-line:max-line-length
export function formatSignalFlamingoResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.SignalFlamingo,
): resources.SignalFlamingoResource {
  const ret: resources.SignalFlamingoResource = retObj as resources.SignalFlamingoResource;
  ret.skypeguid = nativeResource.skypeguid;
  return ret;
}

// tslint:disable-next-line:max-line-length
export function formatMemberConsumptionHorizonUpdateResource(
  retObj: resources.Resource,
  nativeResource: nativeMessageResources.MemberConsumptionHorizonUpdate,
): resources.MemberConsumptionHorizonUpdateResource {
  const ret: resources.MemberConsumptionHorizonUpdateResource = retObj as resources.MemberConsumptionHorizonUpdateResource;
  return ret;
}

export function formatMessageResource(nativeResource: nativeResources.MessageResource): resources.Resource {
  switch (nativeResource.messagetype) {
    // case 'RichText/UriObject':
    // tslint:disable-next-line:max-line-length
    // return formatUriObjectResource(formatFileResource(formatGenericMessageResource(nativeResource, nativeResource.messagetype), <nativeMessageResources.UriObject> nativeResource), <nativeMessageResources.UriObject> nativeResource);
    case 'RichText/UriObject':
    case 'RichText/Media_Video':
      return formatMediaVideoResource(
        formatFileResource(
          formatGenericMessageResource(nativeResource, nativeResource.messagetype),
          <nativeMessageResources.MediaVideo>nativeResource,
        ),
        <nativeMessageResources.MediaVideo>nativeResource,
      );
    case 'RichText/Media_AudioMsg':
      return formatMediaAudioResource(
        formatFileResource(
          formatGenericMessageResource(nativeResource, nativeResource.messagetype),
          <nativeMessageResources.MediaAudio>nativeResource,
        ),
        <nativeMessageResources.MediaAudio>nativeResource,
      );
    case 'RichText/Media_GenericFile':
      return formatMediaGenericFileResource(
        formatFileResource(
          formatGenericMessageResource(nativeResource, nativeResource.messagetype),
          <nativeMessageResources.MediaGenericFile>nativeResource,
        ),
        <nativeMessageResources.MediaGenericFile>nativeResource,
      );
    case 'RichText/Location':
      return formatLocationResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.LocationObject>nativeResource,
      );
    case 'Event/Call':
      return formatEventCallResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.EventCall>nativeResource,
      );
    case 'RichText':
      return formatRichTextResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.RichText>nativeResource,
      );
    case 'Text':
      return formatTextResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.Text>nativeResource,
      );
    case 'Control/ClearTyping':
      return formatControlClearTypingResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.ControlClearTyping>nativeResource,
      );
    case 'Control/Typing':
      // tslint:disable-next-line:max-line-length
      return formatControlTypingResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.ControlTyping>nativeResource,
      );
    case 'Signal/Flamingo': // incoming call request
      // tslint:disable-next-line:max-line-length
      return formatSignalFlamingoResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.SignalFlamingo>nativeResource,
      );
    case 'ThreadActivity/MemberConsumptionHorizonUpdate':
      // tslint:disable-next-line:max-line-length
      return formatMemberConsumptionHorizonUpdateResource(
        formatGenericMessageResource(nativeResource, nativeResource.messagetype),
        <nativeMessageResources.MemberConsumptionHorizonUpdate>nativeResource,
      );
    default:
      // tslint:disable-next-line:max-line-length
      // throw new Error(`Unknown ressource.messageType (${JSON.stringify(nativeResource.messagetype)}) for resource:\n${JSON.stringify(nativeResource, null, "\t")}`);
      // log disabled due to flood
      return {
        type: 'Ignored',
        id: 'Ignored',
        composeTime: new Date(),
        arrivalTime: new Date(),
        from: {
          raw: 'Ignored',
          prefix: 1,
          username: 'Ignored',
        },
        conversation: 'Ignored',
      };
  }
}

type NativeFileResouce =
  | nativeMessageResources.MediaGenericFile
  | nativeMessageResources.UriObject
  | nativeMessageResources.MediaVideo
  | nativeMessageResources.MediaAudio;

function formatFileResource(retObj: resources.Resource, native: NativeFileResouce): resources.FileResource {
  const ret: resources.FileResource = retObj as resources.FileResource;
  const $: cheerio.Root = cheerio.load(native.content || '');
  const obj: cheerio.Cheerio = $('URIObject');
  ret.uri_type = obj.attr('type') || '';
  ret.uri = obj.attr('uri') || '';
  ret.uri_thumbnail = obj.attr('url_thumbnail') || '';
  ret.uri_w_login = $(obj.find('a')).attr('href') || '';
  const sizeString: string | undefined = $(obj.find('FileSize')).attr('v');
  if (sizeString !== undefined) {
    ret.file_size = parseInt(sizeString, 10);
  }
  ret.original_file_name = $(obj.find('OriginalName')).attr('v') || '';
  return ret;
}

// tslint:disable-next-line:max-line-length
function formatMediaGenericFileResource(
  retObj: resources.FileResource,
  native: nativeMessageResources.MediaGenericFile,
): resources.RichTextMediaGenericFileResource {
  const ret: resources.RichTextMediaGenericFileResource = retObj as resources.RichTextMediaGenericFileResource;
  return ret;
}

// tslint:disable-next-line:max-line-length
function formatMediaVideoResource(
  retObj: resources.FileResource,
  native: nativeMessageResources.MediaVideo,
): resources.RichTextMediaGenericFileResource {
  const ret: resources.RichTextMediaGenericFileResource = retObj as resources.RichTextMediaGenericFileResource;
  return ret;
}

function formatMediaAudioResource(
  retObj: resources.FileResource,
  native: nativeMessageResources.MediaAudio,
): resources.RichTextMediaGenericFileResource {
  const ret: resources.RichTextMediaGenericFileResource = retObj as resources.RichTextMediaGenericFileResource;
  return ret;
}

// function formatUriObjectResource(
//   retObj: resources.FileResource,
//   native: nativeMessageResources.UriObject,
// ): resources.RichTextUriObjectResource {
//   const ret: resources.RichTextUriObjectResource = retObj as resources.RichTextUriObjectResource;
//   return ret;
// }

function formatLocationResource(
  retObj: resources.Resource,
  native: nativeMessageResources.LocationObject,
): resources.RichTextLocationResource {
  const ret: resources.RichTextLocationResource = retObj as resources.RichTextLocationResource;
  const $: cheerio.Root = cheerio.load(native.content);
  const obj: cheerio.Cheerio = $('location');
  ret.latitude = parseInt(obj.attr('latitude') || '0', 10);
  ret.longitude = parseInt(obj.attr('longitude') || '0', 10);
  ret.altitude = parseInt(obj.attr('altitude') || '0', 10);
  ret.speed = parseInt(obj.attr('speed') || '0', 10);
  ret.course = parseInt(obj.attr('course') || '0', 10);
  ret.address = obj.attr('address') || '';
  ret.pointOfInterest = obj.attr('pointOfInterest') || '';
  ret.map_url = $(obj.find('a')).attr('href') || '';
  return ret;
}

// tslint:disable-next-line:max-line-length
function formatEventCallResource(
  retObj: resources.Resource,
  native: nativeMessageResources.EventCall,
): resources.EventCallResource {
  const ret: resources.EventCallResource = retObj as resources.EventCallResource;
  const $: cheerio.Root = cheerio.load(native.content);
  const type: string = $('partlist').attr('type') || '';
  switch (type) {
    case 'started':
    case 'ended':
    case 'missed':
      ret.event_type = type;
      break;
    default:
      throw new Error(`Unknown call state of: ${type}`);
  }
  let shortest: number | null = null;
  let connected = false;
  const participants: resources.CallParticipant[] = [];
  const parts: cheerio.Element[] = $('part').toArray();
  for (const part of parts) {
    const pjs: cheerio.Cheerio = $(part);
    const add: resources.CallParticipant = {
      displayName: pjs.find('name').text(),
      username: pjs.attr('identity') || '',
    };
    const duration: string | undefined = pjs.find('duration').text();
    if (duration !== undefined && duration !== '') {
      add.duration = parseInt(duration, 10);
      if (add.duration > 0) {
        connected = true;
        if (shortest === null || add.duration < shortest) {
          shortest = add.duration;
        }
      }
    }
    participants.push(add);
  }
  ret.participants = participants;
  ret.call_connected = connected || participants.length > 1;
  if (shortest !== null) {
    ret.duration = shortest;
  }
  return ret;
}

export function formatEventMessage(native: nativeEvents.EventMessage): events.EventMessage {
  let resource: resources.Resource | null;
  switch (native.resourceType) {
    case 'UserPresence':
      resource = null;
      break;
    case 'EndpointPresence':
      resource = null;
      break;
    case 'ConversationUpdate':
      resource = formatConversationUpdateResource(native.resource as nativeResources.ConversationUpdate);
      break;
    case 'MessageUpdate':
      resource = formatMessageResource(<nativeResources.MessageResource>native.resource);
      break;
    case 'NewMessage':
      resource = formatMessageResource(<nativeResources.MessageResource>native.resource);
      break;
    case 'CustomUserProperties':
      resource = formatCustomUserPropertiesResource(native.resource as nativeResources.CustomUserPropertiesResource);
      break;
    default:
      // tslint:disable-next-line:max-line-length
      // throw new Error(`Unknown EventMessage.resourceType (${JSON.stringify(native.resourceType)}) for Event:\n${JSON.stringify(native)}`);
      resource = null;
      // log disabled due to flood
      break;
  }

  return {
    id: native.id,
    type: native.type,
    resourceType: native.resourceType,
    time: new Date(native.time),
    resourceLink: native.resourceLink,
    resource,
  };
}
