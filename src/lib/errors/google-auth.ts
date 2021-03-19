import { Incident } from 'incident';

export namespace GoogleAuthRequired {
  export type Name = 'GoogleAuthRequired';
  export const name: Name = 'GoogleAuthRequired';

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Data {}

  export type Cause = undefined;
}

export type GoogleAuthRequired = Incident<GoogleAuthRequired.Data, GoogleAuthRequired.Name, GoogleAuthRequired.Cause>;

export namespace GoogleAuthRequired {
  export type Type = GoogleAuthRequired;

  export function format(): string {
    return 'GoogleAuthRequired';
  }

  export function create(username?: string): GoogleAuthRequired {
    return Incident(name, { username }, format);
  }
}
