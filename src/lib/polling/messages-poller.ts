import _events from 'events';
import { Incident } from 'incident';
import { UnexpectedHttpStatusError } from '../errors';
import { readSetRegistrationTokenHeader } from '../helpers/register-endpoint';
import { Context as ApiContext } from '../interfaces/api/context';
import * as events from '../interfaces/api/events';
import * as httpIo from '../interfaces/http-io';
import * as nativeEvents from '../interfaces/native-api/events';
import * as messagesUri from '../messages-uri';
import { formatEventMessage } from '../utils/formatters';

export class MessagesPoller extends _events.EventEmitter {
  io: httpIo.HttpIo;
  apiContext: ApiContext;
  activeState: boolean | false;
  notificationUri: string | undefined;

  constructor(io: httpIo.HttpIo, apiContext: ApiContext) {
    super();

    this.io = io;
    this.apiContext = apiContext;
    this.activeState = false;
    this.notificationUri = undefined;
  }

  isActive(): boolean {
    return this.activeState;
  }

  run(): this {
    if (this.isActive()) {
      return this;
    }
    this.activeState = true;
    // moved from setInterval to setTimeout as the request
    // may resolve in ±1minute if no new messages / notifications are available
    // tslint:disable-next-line no-floating-promises
    this.getMessagesLoop();
    // tslint:disable-next-line no-floating-promises
    this.getNotificationsLoop(); // using this may result in double notifications
    return this;
  }

  stop(): this {
    if (!this.isActive()) {
      return this;
    }
    this.activeState = false;
    // 1 more response will still be returned after stopping the listener
    return this;
  }

  protected async getMessagesLoop(): Promise<void> {
    if (this.isActive()) {
      // console.log(new Date() +"~~~~~~~~~~~~~~~~~~~~~~~getMessagesLoop  START ~~~~~~~~~~~~~~~~~~~~~~~~~~");
      await this.getMessages();
      // console.log(new Date() +"~~~~~~~~~~~~~~~~~~~~~~~getMessagesLoop  END   ~~~~~~~~~~~~~~~~~~~~~~~~~~");
      setTimeout(this.getMessagesLoop.bind(this), 100);
    }
  }

  protected async getNotificationsLoop(): Promise<void> {
    if (this.isActive()) {
      // console.log(new Date() +"~~~~~~~~~~~~~~~~~~~~~~~getNotificationsRecursive  START ~~~~~~~~~~~~~~~~~~~~~~~~~~");
      await this.getNotifications();
      // console.log(new Date() +"~~~~~~~~~~~~~~~~~~~~~~~getNotificationsRecursive  END   ~~~~~~~~~~~~~~~~~~~~~~~~~~");
      // tslint:disable-next-line no-floating-promises
      this.getNotificationsLoop();
    }
  }

  /**
   * Get the new messages / events from the server.
   * This function always returns a successful promise once the messages are retrieved or an error happens.
   *
   * If any error happens, the message-poller will emit an `error` event with the error.
   */
  protected async getMessages(): Promise<void> {
    try {
      const url: string = messagesUri.poll(
        this.apiContext.registrationToken.host,
        'ME',
        this.apiContext.registrationToken.endpointId,
      );
      const requestOptions: httpIo.PostOptions = {
        // TODO: explicitly define user, endpoint and subscription
        url,
        cookies: this.apiContext.cookies,
        headers: {
          Authentication: 'skypetoken=' + this.apiContext.skypeToken.value,
          RegistrationToken: this.apiContext.registrationToken.raw,
          EndpointId: this.apiContext.registrationToken.endpointId,
          BehaviorOverride: 'redirectAs404',
        },
        proxy: this.apiContext.proxy,
      };
      if (this.apiContext.ackId) {
        requestOptions.queryString = {
          ackId: this.apiContext.ackId,
        };
      }
      const res: httpIo.Response = await this.io.post(requestOptions);

      if (res.headers['set-registrationtoken']) {
        const registrationTokenHeader: string = res.headers['set-registrationtoken'];

        // for debug, will remove
        console.log(`Updating registrationtoken -> getMessages() -> ${res.headers['set-registrationtoken']}`);

        this.apiContext.registrationToken = readSetRegistrationTokenHeader(
          this.apiContext.registrationToken.host,
          registrationTokenHeader,
        );
      }

      if (res.statusCode !== 200) {
        const cause: UnexpectedHttpStatusError = UnexpectedHttpStatusError.create(res, new Set([200]), requestOptions);
        this.emit('error', Incident(cause, 'poll', 'Unable to poll the messages'));
        return;
      }

      const body: { eventMessages?: nativeEvents.EventMessage[] } = JSON.parse(res.body);

      if (body.eventMessages !== undefined) {
        for (const msg of body.eventMessages) {
          const formatted: events.EventMessage = formatEventMessage(msg);
          if (!this.apiContext.ackId || formatted.id > this.apiContext.ackId) {
            this.apiContext.ackId = formatted.id;
          }
          if (formatted.resource !== null) {
            this.emit('event-message', formatted);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof Error)) {
        // eslint-disable-next-line no-ex-assign
        err = new Error(err);
      }
      this.emit('error', Incident(err, 'poll', 'An error happened while processing the polled messages'));
    }
  }

  /**
   * Get the new messages / notifications from the server, this is used to get messages that are not
   * returned by the old poll endpoint (ex. end call when initiator is on mobile).
   * This function always returns a successful promise once the messages are retrieved or an error happens.
   *
   * If any error happens, the message-poller will emit an `error` event with the error.
   */
  protected async getNotifications(): Promise<void> {
    try {
      const requestOptions: httpIo.GetOptions = {
        url: this.notificationUri ? this.notificationUri : await messagesUri.notifications(this.io, this.apiContext),
        cookies: this.apiContext.cookies,
        headers: {
          Authentication: 'skypetoken=' + this.apiContext.skypeToken.value,
        },
        proxy: this.apiContext.proxy,
      };
      const res: httpIo.Response = await this.io.get(requestOptions);

      if (res.headers['set-registrationtoken']) {
        const registrationTokenHeader: string = res.headers['set-registrationtoken'];

        // for debug, will remove
        console.log(`Updating registrationtoken -> getNotifications() -> ${res.headers['set-registrationtoken']}`);

        this.apiContext.registrationToken = readSetRegistrationTokenHeader(
          this.apiContext.registrationToken.host,
          registrationTokenHeader,
        );
      }

      if (res.statusCode !== 200) {
        const cause: UnexpectedHttpStatusError = UnexpectedHttpStatusError.create(res, new Set([200]), requestOptions);
        this.emit('error', Incident(cause, 'poll', 'Unable to poll the notifications'));
        return;
      }

      const body: { eventMessages?: nativeEvents.EventMessage[]; next?: string } = JSON.parse(res.body);
      if (body.next) {
        // added before parsing messages in case parsing messages fails
        this.notificationUri = body.next + '&pageSize=20';
      }
      if (body.eventMessages !== undefined) {
        for (const msg of body.eventMessages) {
          // lastMsgId = msg.id;
          const formatted: events.EventMessage = formatEventMessage(msg);
          if (!this.apiContext.ackId || formatted.id > this.apiContext.ackId) {
            this.apiContext.ackId = formatted.id;
          }
          if (formatted.resource !== null) {
            this.emit('event-message', formatted);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof Error)) {
        // eslint-disable-next-line no-ex-assign
        err = new Error(err);
      }
      this.emit('error', Incident(err, 'poll', 'An error happened while processing the polled notifications'));
    }
  }
}
