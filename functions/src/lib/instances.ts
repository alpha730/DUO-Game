// DECISION (first prod deploy, Oct 21): Cloud Run reserves maxInstances × 1 vCPU per function
// against the project's regional CPU quota. 24 functions × the global 20 went over it ("Quota exceeded
// for total allowable CPU per project per region"), so only the player functions keep 20; the ones
// a few staff or a schedule call get small caps (and raid joins 10). The project's quota is
// tight (the Free Trial), so a new function needs room: lower a cap here before adding one.

/** Admin screens (/admin, /stage): a handful of people. */
export const STAFF_INSTANCES = { maxInstances: 2 } as const;
/** Prize desk (/redeem): a few volunteers' phones. */
export const DESK_INSTANCES = { maxInstances: 5 } as const;
/**
 * Owl Raid joins: a burst when a raid opens, but 10 instances × 80 concurrent requests is ~800 joins at
 * once. (The busiest player functions — getMyState, startAttempt, submitAttempt, completeProfile —
 * keep the global 20.)
 */
export const RAID_INSTANCES = { maxInstances: 10 } as const;
/** Schedules: one run at a time. */
export const SCHEDULE_INSTANCES = { maxInstances: 1 } as const;
