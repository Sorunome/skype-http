import { Incident } from 'incident';
import { map } from 'lodash';

import * as io from '../interfaces/http-io';
import { Context } from '../interfaces/api/context';

import * as messagesUri from '../messages-uri';
import { formatMessageResource } from '../utils/formatters';
import { Resource } from '../interfaces/api';

interface GetMessagesQuery {
  startTime: number; // a timestamp ?
  view: 'msnp24Equivalent' | string;
  targetType: string; // seen: Passport|Skype|Lync|Thread
}
export async function getMessages(io: io.HttpIo, apiContext: Context, conversationId: string): Promise<Resource[]> {
  const query: GetMessagesQuery = {
    startTime: 0,
    view: 'msnp24Equivalent',
    targetType: 'Passport|Skype|Lync|Thread',
  };
  const requestOptions: io.GetOptions = {
    url: messagesUri.messages(apiContext.registrationToken.host, messagesUri.DEFAULT_USER, conversationId),
    cookies: apiContext.cookies,
    queryString: query,
    headers: {
      RegistrationToken: apiContext.registrationToken.raw,
    },
    proxy: apiContext.proxy,
  };

  const res = await io.get(requestOptions);

  if (res.statusCode !== 200) {
    return Promise.reject(new Incident('net', 'Unable to fetch messages from conversation'));
  }
  const response = JSON.parse(res.body);

  return map(response.messages, formatMessageResource);
}
