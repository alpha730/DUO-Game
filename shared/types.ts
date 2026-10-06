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

// ---------- Fixed values ----------

export const LINGO_COUNT = 10;

/** Profile = name + email only (SPEC §4). */
export const NAME_MIN = 2;
export const NAME_MAX = 40;

export type Role = "admin" | "volunteer";
/** pronounce/speak are voice (mic); meaning/question are 4-option taps. */
export type ChallengeType = "pronounce" | "speak" | "meaning" | "question";
export const CHALLENGE_TYPES = ["pronounce", "speak", "meaning", "question"] as const;
export const isVoiceChallenge = (t: ChallengeType) => t === "pronounce" || t === "speak";
export type AttemptStatus = "open" | "won" | "failed" | "forfeit";
export type RaidStatus = "scheduled" | "active" | "ended";
export type FinalStatus = "idle" | "showing" | "recording" | "scoring" | "done";

// ---------- Collection names ----------

export const COL = {
  users: "users",
  catches: "catches", // subcollection of users/{uid}
  lingos: "lingos",
  config: "config",
  challenges: "challenges", // Owl Raid challenges (raid_{id}); the old date × Lingo ones are an archive
  questions: "questions", // the question pool (SPEC §9), server-only
  attempts: "attempts",
  pointsLog: "pointsLog",
  leaderboard: "leaderboard",
  raids: "raids",
  players: "players", // subcollection of raids/{id}
  shards: "shards", // subcollection of raids/{id}: the joined counter, RAID_SHARDS docs
  prizes: "prizes",
  redemptions: "redemptions",
  final: "final",
} as const;

export const DOC = {
  gameConfig: "game", // config/game
  studentsBoard: "students", // leaderboard/students
  finalState: "state", // final/state
} as const;

/** challenges/{date}_{lingoId} */
export const challengeId = (date: IstDate, lingoId: string) => `${date}_${lingoId}`;
/** challenges/raid_{raidId} — an Owl Raid's own challenge (never today's normal one). */
export const raidChallengeId = (raidId: string) => `raid_${raidId}`;

// ---------- Documents (SPEC §4) ----------

/** users/{uid} — owner read only */
export interface UserDoc {
  name: string;
  email: string;
  points: number;
  /** Admin-only cheat signals: count of too-fast answers, and "too good to be true" (lib/cheat.ts). */
  flags?: number;
  suspect?: boolean;
  /** The user's one open attempt (set by startAttempt, cleared when it ends); avoids querying attempts. */
  openAttemptId?: string | null;
  /**
   * Lingos tried on `triedDate` (SPEC §2: one try per Lingo per IST day, 4 different Lingos; won,
   * failed and forfeit all count). Treat as [] when triedDate ≠ today. Raids are not listed here.
   */
  triedToday?: string[];
  triedDate?: IstDate | null;
  /** Pool question ids this player has been asked (never repeated across days while others are left). */
  seenQ?: string[];
  /** Target words asked on `wordsDate` (the same word is not asked twice in a day). */
  wordsToday?: string[];
  wordsDate?: IstDate | null;
  /** Non-raid attempts used on `attemptsDate`; treat as 0 when attemptsDate ≠ today. */
  attemptsToday: number;
  attemptsDate: IstDate | null;
  /**
   * IST days in a row with at least one WIN — display only, 0 points. Days with only failed or
   * forfeited attempts don't count; a day without a win resets it to 0.
   */
  dayStreak: number;
  /** Last IST date with a win (drives dayStreak). */
  lastPlayDate: IstDate | null;
  lingosCaught: number;
  allTenBonus: boolean;
  /** lingoIds, max 2; empty until chosen after the first 2 catches. */
  favorites: string[];
  favoriteChangesLeft: number;
  // Leaderboard tie-breaks (SPEC §2): points → accuracy → avg answer time → reached first.
  wins: number;
  /** failed + forfeited (incl. expired and auto-forfeited) */
  losses: number;
  /** Sum of answerMs over wins; avg answer time = totalAnswerMs / wins. */
  totalAnswerMs: number;
  /** When the user reached their current points total (earlier ranks higher on ties). */
  pointsReachedAt: FireTimestamp | null;
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
  attemptsPerDay: number; // 4 different Lingos a day, one try each — won, failed, forfeited all count; raids don't
  catchesPerLingoPerDay: number; // 1 — ONE try per Lingo per day (won, failed or forfeit all close it)
  favoritesCount: number; // 2
  favoriteChanges: number; // 1 for the whole game
  pronounceSeconds: number; // 15
  speakSeconds: number; // 20
  meaningSeconds: number; // 15
  questionSeconds: number; // 20
  graceSeconds: number; // 2
  speakPassRatio: number; // 0.8
  /** Every correct answer: +this per full second left on the server timer (clamped 0…timer). */
  speedBonusPerSecond: number; // 1
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
  pronounceSeconds: 15,
  speakSeconds: 20,
  meaningSeconds: 15,
  questionSeconds: 20,
  graceSeconds: 2,
  speakPassRatio: 0.8,
  speedBonusPerSecond: 1,
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

/** Seconds allowed for each challenge type. */
export function timerSeconds(type: ChallengeType, rules: GameRules): number {
  return {
    pronounce: rules.pronounceSeconds,
    speak: rules.speakSeconds,
    meaning: rules.meaningSeconds,
    question: rules.questionSeconds,
  }[type];
}

/** challenges/{date}_{lingoId} — never client-readable. Medium difficulty (CEFR B1–B2). */
export interface PronounceChallengeDoc {
  type: "pronounce";
  /** Say this word. */
  word: string;
  /** Other spellings speech recognition may return (e.g. "colour" for "color"). Never sent to the client. */
  accept?: string[];
}
export interface SpeakChallengeDoc {
  type: "speak";
  /** Say this sentence; pass at ≥ speakPassRatio of its words. */
  phrase: string;
}
export interface MeaningChallengeDoc {
  type: "meaning";
  word: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}
export interface QuestionChallengeDoc {
  type: "question";
  /** e.g. fill in the blank, pick the correct sentence, synonym/antonym, simple grammar */
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}
export type ChallengeDoc = PronounceChallengeDoc | SpeakChallengeDoc | MeaningChallengeDoc | QuestionChallengeDoc;

// ---------- Question pool (SPEC §9) ----------

export type QuestionLevel = "medium" | "hard";
export const QUESTION_LEVELS = ["medium", "hard"] as const;
/** Types in the pool (speak is only used by Owl Raids). */
export type QuestionType = "meaning" | "question" | "pronounce";
export const QUESTION_TYPES = ["meaning", "question", "pronounce"] as const;

/**
 * questions/{id} — never client-readable; `correctIndex` / `accept` never sent before answering.
 * meaning: "What is the closest meaning of “word”?" + 4 options; question: fill-in-the-blank `prompt`
 * + 4 options (`target` = the answer word); pronounce: the player says `word`.
 */
export type QuestionDoc = (PronounceChallengeDoc | MeaningChallengeDoc | (QuestionChallengeDoc & { target: string })) & {
  level: QuestionLevel;
  /** Shown on the result screen after answering (meaning/question): what the word means. */
  explanation: string;
};
/** One row of scripts/content/question-pool-*.json / the /admin upload. */
export type QuestionUpload = QuestionDoc & { id: string };

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
  /** 0–1 word match (speak), else 0/1. */
  score?: number;
  /** Server time the answer arrived (set by submitAttempt). */
  receivedAt?: FireTimestamp;
  /** receivedAt − startedAt */
  answerMs?: number;
  /** floor((expiresAt − receivedAt)/1000), clamped 0…timer; only counts on a win. */
  speedBonus?: number;
  /** Cheat signal (flag only): answered faster than a human could (functions/src/lib/cheat.ts). */
  flagged?: boolean;
  flagReason?: string;
  /** Pool question asked (normal tries); raids use challenges/raid_{raidId}. */
  questionId?: string;
  level?: QuestionLevel;
  /**
   * DECISION: a server-only copy of the question asked (attempts are never client-readable), so
   * submitAttempt scores against exactly what was shown without reading the pool again.
   */
  question?: ChallengeDoc & { explanation?: string };
}

export type PointsReason =
  | "firstCatch"
  | "repeatCatch"
  | "favoriteCatch"
  | "speed"
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
  points: number;
  /** wins ÷ (wins + losses), 0–1 */
  accuracy: number;
  /** totalAnswerMs ÷ wins */
  avgAnswerMs: number;
}

/** leaderboard/students — signed-in read */
export interface StudentsBoardDoc {
  /** Top 100 in tie-break order: points → accuracy → avgAnswerMs (low first) → pointsReachedAt. */
  top: StudentRow[];
  updatedAt: FireTimestamp;
}

/** raids/{id} — signed-in read */
export interface RaidDoc {
  posterIndex: number;
  lingoId: string;
  startAt: FireTimestamp;
  endAt: FireTimestamp;
  minPlayers: number; // 20
  unlocked: boolean;
  status: RaidStatus;
}

/** Shards of a raid's joined counter (Day 8): one random shard per join, summed for the count. */
export const RAID_SHARDS = 10;
/** raids/{id}/shards/{0..9} — signed-in read; the waiting room sums them live. */
export interface RaidShardDoc {
  count: number;
}

/** raids/{id}/players/{uid} — never client-readable */
export interface RaidPlayerDoc {
  joinedAt: FireTimestamp;
  /** Set by startAttempt: the player's one try at this raid (won, failed or forfeit). */
  attemptId?: string;
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

/** The email comes from the (verified) login, not from the client. */
export interface CompleteProfileInput {
  name: string;
}
export interface CompleteProfileOutput {
  ok: true;
}

/** UserDoc with timestamps as millis, as returned by functions */
export type UserView = Omit<UserDoc, "createdAt" | "pointsReachedAt"> & {
  createdAt: number;
  pointsReachedAt: number | null;
};
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
  /**
   * false when the browser has no SpeechRecognition (SPEC §3.8): a pronounce/speak challenge is then
   * refused ("needs-speech") without using an attempt or revealing its content. Default true.
   */
  speech?: boolean;
}
/** Never contains the answer: no `accept`, no `correctIndex` (CLAUDE.md rule 4). */
export interface StartAttemptOutput {
  attemptId: string;
  type: ChallengeType;
  /** pronounce, meaning */
  word?: string;
  /** speak */
  phrase?: string;
  /** question */
  prompt?: string;
  /** meaning, question — always 4 */
  options?: string[];
  expiresAt: number;
  serverNow: number;
  /** Daily attempts left after this one (unchanged for raid attempts). */
  attemptsLeft: number;
  /** Pool difficulty (normal tries): hard from a favourite's 6th streak day. */
  level?: QuestionLevel;
}

export interface SubmitAttemptInput {
  attemptId: string;
  /** pronounce, speak */
  transcript?: string;
  /** meaning, question: 0–3 */
  choice?: number;
}
export type BonusKind = "max" | "allTen" | "raid";
export interface Bonus {
  kind: BonusKind;
  points: number;
}
export interface SubmitAttemptOutput {
  result: "won" | "failed";
  /** Total added by this attempt, speed bonus and bonuses included; 0 on a fail. */
  pointsAdded: number;
  /** Part of pointsAdded: +1 per full second left (0 on a fail). */
  speedBonus: number;
  bonuses: Bonus[];
  /** Lingo level after this attempt (unchanged on a fail). */
  newLevel: Level;
  /** Present when the Lingo is a favourite. */
  favStreak?: number;
  newTotal: number;
  missedWords?: string[];
  /** True when the user has ≥ 2 catches and hasn't chosen favourites → open /favorites. */
  needsFavorites: boolean;
  /** An Owl Raid attempt (base = raidCatchPoints instead of the normal catch points). */
  raid?: boolean;
  /** meaning / question, after answering only: the right option and what it means (for learning). */
  answer?: { text: string; explanation?: string };
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
  /** This player already used their one try at this raid. */
  tried: boolean;
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

/** "medium/meaning" → count */
export type QuestionCounts = Record<`${QuestionLevel}/${QuestionType}`, number>;
export interface AdminUpsertQuestionsInput {
  /** The whole pool: replaces questions/* (ids not in the upload are removed). */
  questions: QuestionUpload[];
}
export interface AdminUpsertQuestionsOutput {
  written: number;
  removed: number;
  counts: QuestionCounts;
}

/** A challenge without its date/Lingo key (same shape as challenges/*). */
export type ChallengeInput =
  | { type: "pronounce"; word: string; accept?: string[] }
  | { type: "speak"; phrase: string }
  | { type: "meaning"; word: string; options: string[]; correctIndex: number }
  | { type: "question"; prompt: string; options: string[]; correctIndex: number };

export interface AdminCreateRaidInput {
  posterIndex: number;
  lingoId: string;
  startAt: number;
  minutes?: number; // default 15
  minPlayers?: number; // default 20
  /** The raid's own challenge, stored server-only at challenges/raid_{raidId}. */
  challenge: ChallengeInput;
}
export interface AdminCreateRaidOutput {
  raidId: string;
}

export interface LockGameInput {
  locked: boolean;
}
export interface LockGameOutput {
  locked: boolean;
}

export interface AdminUploadError {
  /** 1-based row in the uploaded array (0 = the whole upload). */
  row: number;
  message: string;
}

/** One row of the admin's player lists (suspicious players, top-20 export). */
export interface AdminPlayerRow {
  rank?: number;
  uid: string;
  name: string;
  email: string;
  points: number;
  wins: number;
  /** 0–1 */
  accuracy: number;
  /** ms per win (0 with no wins) */
  avgAnswerMs: number;
  flags: number;
  suspect: boolean;
}
export interface AdminPlayersOutput {
  rows: AdminPlayerRow[];
  /** leaderboard time the top 20 come from (top-20 export) */
  updatedAt?: number;
}

export interface AdminStatsOutput {
  today: IstDate;
  users: number;
  attemptsToday: number;
  winsToday: number;
  /** Questions in the pool per level × type. */
  questions: QuestionCounts;
  questionTotal: number;
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
