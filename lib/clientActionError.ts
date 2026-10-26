/** Expected client input/state failure, safe to return without infrastructure alerts. */
export class ClientActionError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
