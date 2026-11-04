/** What checking a CLI sign-in returns (defprod/CHG-502, USER-58 AC3, AC4, AC6), as data the CLI branches on. */
export enum CliLoginPollStatus {
    /** Not decided yet: check again after `interval` seconds. */
    pending = 'pending',
    /** Checked sooner than the interval: wait the (widened) `interval` before checking again. */
    slowDown = 'slowDown',
    /** The person denied it, or the key could not be issued. */
    denied = 'denied',
    /** Not approved in time, already collected, or unknown. */
    expired = 'expired',
    /** Approved: the key is in this response, and in no other. */
    approved = 'approved'
}
