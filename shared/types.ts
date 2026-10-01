// Single source of truth for data shapes (SPEC §4) and function I/O (SPEC §5).
// Copied into functions/src/shared by functions/scripts/copy-shared.mjs — edit only this file.

// DECISION: Firestore Timestamps differ between the web SDK and firebase-admin, so documents use
// this structural type (both satisfy it). Function inputs/outputs use epoch millis (number) instead.
export interface FireTimestamp {
  seconds: number;
  nanoseconds: number;
  toMillis(): number;
  toDate(): Date;
}

/** IST calendar date, `YYYY-MM-DD` in Asia/Kolkata. */
export type IstDate = string;

// ---------- Fixed lists ----------

export const DEPARTMENTS = ["CSE", "AI&DS", "AI&ML", "IT", "ECE", "EE", "ME", "CE", "Other"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const YEARS = [1, 2, 3, 4] as const;
export type Year = (typeof YEARS)[number];

export const LINGO_COUNT = 10;

export type Role = "admin" | "volunteer";
export type ChallengeType = "speak" | "meaning";
export type AttemptStatus = "open" | "won" | "failed" | "forfeit";
export type RaidStatus = "scheduled" | "active" | "ended";
export type FinalStatus = "idle" | "showing" | "recording" | "scoring" | "done";

// ---------- Collection names ----------

export const COL = {
  users: "users",
  catches: "catches", // subcollection of users/{uid}
  lingos: "lingos",
  config: "config",
  challenges: "challenges",
  attempts: "attempts",
  rollNumbers: "rollNumbers",
  pointsLog: "pointsLog",
  leaderboard: "leaderboard",
  raids: "raids",
  players: "players", // subcollection of raids/{id}
  prizes: "prizes",
  redemptions: "redemptions",
  final: "final",
} as const;

export const DOC = {
  gameConfig: "game", // config/game
  studentsBoard: "students", // leaderboard/students
  deptsBoard: "depts", // leaderboard/depts
  finalState: "state", // final/state
} as const;

/** challenges/{date}_{lingoId} */
export const challengeId = (date: IstDate, lingoId: string) => `${date}_${lingoId}`;

// ---------- Documents (SPEC §4) ----------

/** users/{uid} — owner read only */
export interface UserDoc {
  name: string;
  email: string;
  dept: Department;
  year: Year;
  roll: string; // trimmed + uppercased, unique
  points: number;
  /** Non-raid attempts used on `attemptsDate`; treat as 0 when attemptsDate ≠ today. */
  attemptsToday: number;
  attemptsDate: IstDate | null;
  /** Overall "days played in a row" — display only, no points. */
  dayStreak: number;
  lastPlayDate: IstDate | null;
  lingosCaught: number;
  allTenBonus: boolean;
  /** lingoIds, max 2; empty until chosen after the first 2 catches. */
  favorites: string[];
  favoriteChangesLeft: number;
  profileDone: boolean;
  createdAt: FireTimestamp;
}

export type Level = 1 | 2 | 3 | "MAX";

/** users/{uid}/catches/{lingoId} — owner read only; created on the first catch. */
export interface CatchDoc {
  firstCaughtAt: FireTimestamp | null;
  timesCaught: number;
  lastCaughtDate: IstDate | null;
  /** Never goes down. */
  level: Level;
  /** Consecutive IST days caught while a favourite; 0 for non-favourites. */
  favStreak: number;
  maxBonusGiven: boolean;
}

/** lingos/{lingoId} — signed-in read */
export interface LingoDoc {
  name: string;
  detYear: number; // 2016–2025
  posterIndex: number; // 0–9, = MindAR target index
  modelUrl: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  color: string; // hex
}

/** Editable game numbers (SPEC §2), stored in config/game.rules */
export interface GameRules {
  attemptsPerDay: number; // 4 — won, failed, forfeited all count; raids don't
  catchesPerLingoPerDay: number; // 1 — a failed attempt may be retried on the same Lingo
  favoritesCount: number; // 2
  favoriteChanges: number; // 1 for the whole game
  speakSeconds: number; // 20
  meaningSeconds: number; // 15
  graceSeconds: number; // 2
  speakPassRatio: number; // 0.8
  firstCatchPoints: number; // 100 (Level 1)
  repeatCatchPoints: number; // 20 — non-favourite
  favoriteCatchPointsPerDay: number; // 20 × favourite's streak day (day 1 = 20 … day 10 = 200)
  favLevel2Streak: number; // 3
  favLevel3Streak: number; // 6
  favMaxStreak: number; // 10 → MAX form
  maxBonus: number; // 1000, once per Lingo
  nonFavLevel2Catches: number; // 3 total catches
  nonFavLevel3Catches: number; // 6 total catches
  allTenBonus: number; // 1000, once
  raidCatchPoints: number; // 150, outside the daily 4
}

/** SPEC §2 */
export const DEFAULT_RULES: GameRules = {
  attemptsPerDay: 4,
  catchesPerLingoPerDay: 1,
  favoritesCount: 2,
  favoriteChanges: 1,
  speakSeconds: 20,
  meaningSeconds: 15,
  graceSeconds: 2,
  speakPassRatio: 0.8,
  firstCatchPoints: 100,
  repeatCatchPoints: 20,
  favoriteCatchPointsPerDay: 20,
  favLevel2Streak: 3,
  favLevel3Streak: 6,
  favMaxStreak: 10,
  maxBonus: 1000,
  nonFavLevel2Catches: 3,
  nonFavLevel3Catches: 6,
  allTenBonus: 1000,
  raidCatchPoints: 150,
};

/** config/game — signed-in read */
export interface GameConfigDoc {
  startAt: FireTimestamp;
  lockAt: FireTimestamp;
  locked: boolean;
  campusLat: number;
  campusLng: number;
  campusRadiusM: number;
  rules: GameRules;
}

/** challenges/{date}_{lingoId} — never client-readable */
export interface SpeakChallengeDoc {
  type: "speak";
  phrase: string;
}
export interface MeaningChallengeDoc {
  type: "meaning";
  word: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}
export type ChallengeDoc = SpeakChallengeDoc | MeaningChallengeDoc;

/** attempts/{id} — never client-readable */
export interface AttemptDoc {
  uid: string;
  lingoId: string;
  date: IstDate;
  type: ChallengeType;
  raidId?: string;
  startedAt: FireTimestamp;
  expiresAt: FireTimestamp;
  status: AttemptStatus;
  score?: number; // 0–1 match ratio (speak) or 0/1 (meaning)
}

/** rollNumbers/{roll} — never client-readable */
export interface RollNumberDoc {
  uid: string;
}

export type PointsReason =
  | "firstCatch"
  | "repeatCatch"
  | "favoriteCatch"
  | "max"
  | "allTen"
  | "raid"
  | "redeem"
  | "admin";

/** pointsLog/{id} — never client-readable */
export interface PointsLogDoc {
  uid: string;
  amount: number; // negative for redemptions
  reason: PointsReason;
  attemptId?: string;
  createdAt: FireTimestamp;
}

export interface StudentRow {
  uid: string;
  name: string;
  dept: Department;
  points: number;
}

/** leaderboard/students — signed-in read */
export interface StudentsBoardDoc {
  top: StudentRow[]; // top 100
  updatedAt: FireTimestamp;
}

export interface DeptRow {
  dept: Department;
  points: number;
  players: number;
}

/** leaderboard/depts — signed-in read */
export interface DeptsBoardDoc {
  rows: DeptRow[];
  updatedAt: FireTimestamp;
}

/** raids/{id} — signed-in read */
export interface RaidDoc {
  posterIndex: number;
  lingoId: string;
  startAt: FireTimestamp;
  endAt: FireTimestamp;
  minPlayers: number; // 20
  joined: number;
  unlocked: boolean;
  status: RaidStatus;
}

/** raids/{id}/players/{uid} — never client-readable */
export interface RaidPlayerDoc {
  joinedAt: FireTimestamp;
}

/** prizes/{id} — signed-in read */
export interface PrizeDoc {
  name: string;
  cost: number;
  stock: number;
}

/** redemptions/{id} — never client-readable */
export interface RedemptionDoc {
  uid: string;
  prizeId: string;
  cost: number;
  byUid: string; // volunteer/admin who redeemed
  createdAt: FireTimestamp;
}

export interface FinalContestant {
  uid: string;
  name: string;
  dept: Department;
  eliminated: boolean;
}

/** final/state — signed-in read */
export interface FinalStateDoc {
  round: number; // 0 = not started, 1–3
  phrase: string;
  contestants: FinalContestant[];
  scores: Record<string, number>; // uid -> score for the current round
  status: FinalStatus;
}

// ---------- Function I/O (SPEC §5) ----------

export interface CompleteProfileInput {
  name: string;
  dept: Department;
  year: Year;
  roll: string;
}
export interface CompleteProfileOutput {
  ok: true;
}

/** UserDoc with timestamps as millis, as returned by functions */
export type UserView = Omit<UserDoc, "createdAt"> & { createdAt: number };
export type CatchView = Omit<CatchDoc, "firstCaughtAt"> & { lingoId: string; firstCaughtAt: number | null };

export type GetMyStateInput = Record<string, never>;
// DECISION: besides SPEC's {user, catches, serverNow}, getMyState returns the server's IST `today`
// and attempts left, so the client never computes "today" itself (CLAUDE.md).
export interface GetMyStateOutput {
  /** null until the profile is set up. attemptsToday is already reset to 0 if attemptsDate ≠ today. */
  user: UserView | null;
  catches: CatchView[];
  serverNow: number;
  today: IstDate;
  attemptsLeft: number;
  attemptsPerDay: number;
}

export interface StartAttemptInput {
  lingoId: string;
  lat: number;
  lng: number;
  raidId?: string;
}
/** Never contains the answer (correctIndex). */
export interface StartAttemptOutput {
  attemptId: string;
  type: ChallengeType;
  phrase?: string;
  word?: string;
  options?: string[];
  expiresAt: number;
  serverNow: number;
  /** Daily attempts left after this one (unchanged for raid attempts). */
  attemptsLeft: number;
}

export interface SubmitAttemptInput {
  attemptId: string;
  transcript?: string; // speak
  choice?: number; // meaning, 0–3
}
export type BonusKind = "max" | "allTen" | "raid";
export interface Bonus {
  kind: BonusKind;
  points: number;
}
export interface SubmitAttemptOutput {
  result: "won" | "failed";
  /** Total added by this attempt, bonuses included. */
  pointsAdded: number;
  bonuses: Bonus[];
  /** Lingo level after this attempt (unchanged on a fail). */
  newLevel: Level;
  /** Present when the Lingo is a favourite. */
  favStreak?: number;
  newTotal: number;
  missedWords?: string[];
  /** True when the user has ≥ 2 catches and hasn't chosen favourites → open /favorites. */
  needsFavorites: boolean;
}

export interface SetFavoritesInput {
  /** Exactly 2 distinct lingoIds, both already caught. */
  lingoIds: string[];
}
export interface SetFavoritesOutput {
  favorites: string[];
  favoriteChangesLeft: number;
}

/** forfeitAttempt is HTTP: POST body, header `Authorization: Bearer <idToken>`, responds 204. */
export interface ForfeitAttemptBody {
  attemptId: string;
}

export interface JoinRaidInput {
  raidId: string;
  lat: number;
  lng: number;
}
export interface JoinRaidOutput {
  joined: number;
  unlocked: boolean;
}

export interface RedeemPrizeInput {
  uid: string;
  prizeId: string;
}
export interface RedeemPrizeOutput {
  newBalance: number;
}

// Admin functions

export interface AdminSetConfigInput {
  startAt?: number;
  lockAt?: number;
  locked?: boolean;
  campusLat?: number;
  campusLng?: number;
  campusRadiusM?: number;
  rules?: Partial<GameRules>;
}

export type ChallengeUpload =
  | { date: IstDate; lingoId: string; type: "speak"; phrase: string }
  | { date: IstDate; lingoId: string; type: "meaning"; word: string; options: string[]; correctIndex: number };
export interface AdminUpsertChallengesInput {
  challenges: ChallengeUpload[];
}
export interface AdminUpsertChallengesOutput {
  written: number;
}

export interface AdminCreateRaidInput {
  posterIndex: number;
  lingoId: string;
  startAt: number;
  minutes?: number; // default 15
  minPlayers?: number; // default 20
}
export interface AdminCreateRaidOutput {
  raidId: string;
}

export interface LockGameInput {
  locked: boolean;
}

export type FinalControlInput =
  | { action: "start"; topN?: number } // default 20
  | { action: "setPhrase"; phrase: string }
  | { action: "setStatus"; status: FinalStatus }
  | { action: "score"; uid: string; score: number }
  | { action: "eliminate"; keep: number } // keep top N of current round
  | { action: "nextRound" }
  | { action: "reset" };

export interface OkOutput {
  ok: true;
}
