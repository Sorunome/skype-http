import {Incident} from "incident";
import {Contact} from "../interfaces/api/contact";
import {Context} from "../interfaces/api/context";
import * as io from "../interfaces/http-io";

export const VIRTUAL_CONTACTS: Set<string> = new Set(["concierge", "echo123"]);

export async function searchSkypeDirectory(io: io.HttpIo, apiContext: Context, contactId: string): Promise<Contact> {
  if (VIRTUAL_CONTACTS.has(contactId)) {
    // tslint:disable-next-line:max-line-length
    throw new Error(`${JSON.stringify(contactId)} is not a real contact, you cannot get data for ${JSON.stringify(contactId)}`);
  }
  // const requestOptions: io.PostOptions = {
  //   uri: apiUri.userProfiles(),
  //   cookies: apiContext.cookies,
  //   form: {usernames: [contactId]},
  //   headers: {
  //     "X-Skypetoken": apiContext.skypeToken.value,
  //   },
  // };

  const requestOptions: io.GetOptions = {
    uri: `https://skypegraph.skype.com/v2.0/search?searchString=${contactId}&requestId=1557843398852`,
    cookies: apiContext.cookies,
    headers: {
      "Origin": "https://preview.web.skype.com",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36",
      "X-Skypetoken": apiContext.skypeToken.value,
      "Accept": "application/json",
      "X-ECS-ETag": "\"icN4uWD0m7ErUq8mnwfXY+MK1NUHSTRsNn8xplOxPvw=\"",
      "Referer": "https://preview.web.skype.com/",
      "X-SkypeGraphServiceSettings": {
        "experiment": "Default",
        "geoProximity": "disabled",
        "demotionScoreEnabled": "true"
      },
      "X-Skype-Client": "1418/8.45.76.40",

    },
  };
  const res: io.Response = await io.get(requestOptions);
  if (res.statusCode !== 200) {
    return Promise.reject(new Incident("net", "Unable to fetch contact"));
  }
  const body = JSON.parse(res.body);
  return body;
}