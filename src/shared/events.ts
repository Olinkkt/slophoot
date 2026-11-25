export type LobbyPlayer = {
  nickname: string;
};

export type LobbyUpdate = {
  pin: string;
  players: LobbyPlayer[];
};

export type JoinErrorPayload = {
  message: string;
};

export type HostErrorCode = "expired" | "invalid" | "transient";

export type HostErrorPayload = {
  message: string;
  code?: HostErrorCode;
};

export type PlayerJoinPayload = {
  pin: string;
  nickname: string;
};

export type HostReadyPayload = {
  pin: string;
  token: string;
};

export type HostResumePayload = {
  pin: string;
  token: string;
};

export type PointsMode = "standard" | "double" | "none";

export type QuestionType = "choice" | "multi" | "text" | "slider" | "order" | "pairs" | "poll";

type QuestionBase = {
  text: string;
  /** Seconds players have to answer. */
  time: number;
  points: PointsMode;
  /** Optional https picture shown above the answers. */
  image?: string;
  /** Optional line shown to everyone once the round is over. */
  explanation?: string;
};

/** One right answer. True / false is a choice question with two options. */
export type ChoiceQuestion = QuestionBase & {
  type: "choice";
  options: string[];
  correct: number;
};

/** Several right answers. Players tick all that apply. */
export type MultiQuestion = QuestionBase & {
  type: "multi";
  options: string[];
  correct: number[];
};

/** Players type a short answer. Close spellings still count. */
export type TextQuestion = QuestionBase & {
  type: "text";
  answers: string[];
};

/** Players guess a number. Closer is worth more. */
export type SliderQuestion = QuestionBase & {
  type: "slider";
  min: number;
  max: number;
  correct: number;
  /** Guesses this far from `correct` still count as right. */
  tolerance: number;
};

/** Players put the items in order. `items` is the right order. */
export type OrderQuestion = QuestionBase & {
  type: "order";
  items: string[];
};

/** Players match each left item with its right item. */
export type PairsQuestion = QuestionBase & {
  type: "pairs";
  pairs: Array<{ left: string; right: string }>;
};

/** A vote with no right answer and no points. */
export type PollQuestion = QuestionBase & {
  type: "poll";
  options: string[];
};

export type QuizQuestion =
  | ChoiceQuestion
  | MultiQuestion
  | TextQuestion
  | SliderQuestion
  | OrderQuestion
  | PairsQuestion
  | PollQuestion;

export type QuizInput = {
  title: string;
  questions: QuizQuestion[];
};

export type QuizSummary = {
  id: string;
  title: string;
  questionCount: number;
};

export type GamePhase = "question" | "results" | "podium";

export type GameBoardEntry = {
  nickname: string;
  score: number;
};

/** What a player sends for a question. The shape depends on the question type:
 * choice and poll: option index. multi: option indexes. text: string. slider: number.
 * order: shown item indexes in the player's order. pairs: shown right-hand index for each left item. */
export type AnswerValue = number | number[] | string;

export type QuestionReveal =
  | { type: "choice"; correct: number }
  | { type: "multi"; correct: number[] }
  | { type: "text"; answers: string[] }
  | { type: "slider"; correct: number; tolerance: number }
  | { type: "order"; items: string[] }
  | { type: "pairs"; pairs: Array<{ left: string; right: string }> }
  | { type: "poll" };

/** A question as players and the host see it. Answers stay on the server until the round ends. */
export type GameQuestion = {
  type: QuestionType;
  text: string;
  time: number;
  points: PointsMode;
  image: string | null;
  /** Answer tiles for choice, multi, and poll. Empty otherwise. */
  options: string[];
  /** Order: the items in shuffled order. Pairs: the left-hand items. Empty otherwise. */
  items: string[];
  /** Pairs: the right-hand items in shuffled order. Empty otherwise. */
  matches: string[];
  /** Slider only. */
  range: { min: number; max: number } | null;
  /** Null until the round is over. */
  reveal: QuestionReveal | null;
  /** Null until the round is over. */
  explanation: string | null;
};

export type GameMe = {
  nickname: string;
  score: number;
  rank: number;
  choice: AnswerValue | null;
  answered: boolean;
  /** Null until the round is over, and always null for polls. */
  correct: boolean | null;
  gained: number;
};

export type GameState = {
  pin: string;
  phase: GamePhase;
  title: string;
  index: number;
  total: number;
  /** Null on the podium. */
  question: GameQuestion | null;
  /** Milliseconds left in the question phase, measured when this was sent. */
  leftMs: number;
  board: GameBoardEntry[];
  answered: number;
  playerCount: number;
  /** Players per option for choice, multi, and poll. Host only, results phase only. */
  counts: number[] | null;
  /** Players who got it right. Host only, results phase only, not for polls. */
  correctCount: number | null;
  /** The viewing player's own state. Null for the host. */
  me: GameMe | null;
};

export type GameErrorPayload = {
  message: string;
};

export type HostStartPayload = {
  pin: string;
  quizId: string;
};

export type HostNextPayload = {
  pin: string;
};

export type PlayerAnswerPayload = {
  pin: string;
  /** The player's answer. See `AnswerValue` for the shape per question type. */
  choice: AnswerValue;
};

export interface ClientToServerEvents {
  "host:create": () => void;
  "host:resume": (payload: HostResumePayload) => void;
  "host:leaving": () => void;
  "player:join": (payload: PlayerJoinPayload) => void;
  "host:start": (payload: HostStartPayload) => void;
  "host:next": (payload: HostNextPayload) => void;
  "player:answer": (payload: PlayerAnswerPayload) => void;
}

export interface ServerToClientEvents {
  "lobby:update": (state: LobbyUpdate) => void;
  "join:error": (error: JoinErrorPayload) => void;
  "host:error": (error: HostErrorPayload) => void;
  "host:ready": (payload: HostReadyPayload) => void;
  "room:closed": () => void;
  "lobby:hostReconnecting": () => void;
  "lobby:hostReconnected": () => void;
  "host:replaced": () => void;
  "game:state": (state: GameState) => void;
  "game:ended": () => void;
  "game:error": (error: GameErrorPayload) => void;
}
