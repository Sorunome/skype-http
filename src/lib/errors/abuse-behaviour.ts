import { Incident } from 'incident';

export namespace AbuseBehavior {
  export type Name = 'AbuseBehavior';
  export const name: Name = 'AbuseBehavior';

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Data {}

  export type Cause = undefined;
}

export type AbuseBehavior = Incident<AbuseBehavior.Data, AbuseBehavior.Name, AbuseBehavior.Cause>;

export namespace AbuseBehavior {
  export type Type = AbuseBehavior;

  export function format(): string {
    return 'AbuseBehavior';
  }

  export function create(username?: string): AbuseBehavior {
    return Incident(name, { username }, format);
  }
}
