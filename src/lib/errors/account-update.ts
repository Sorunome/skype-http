import { Incident } from 'incident';

export namespace AccountUpdate {
  export type Name = 'AccountUpdate';
  export const name: Name = 'AccountUpdate';

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Data {}

  export type Cause = undefined;
}

export type AccountUpdate = Incident<AccountUpdate.Data, AccountUpdate.Name, AccountUpdate.Cause>;

export namespace AccountUpdate {
  export type Type = AccountUpdate;

  export function format(): string {
    return 'AccountUpdate';
  }

  export function create(username?: string): AccountUpdate {
    return Incident(name, { username }, format);
  }
}
