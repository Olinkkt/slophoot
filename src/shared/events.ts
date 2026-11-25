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

export type QuizQuestion = {
  text: string;
  options: string[];
  correct: number;
  /** Seconds players have to answer. */
  time: number;
};

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

export type GameMe = {
  nickname: string;
  score: number;
  rank: number;
  choice: number | null;
  answered: boolean;
  /** Null until the round is over. */
  correct: boolean | null;
  gained: number;
};

export type GameState = {
  pin: string;
  phase: GamePhase;
  title: string;
  index: number;
  total: number;
  /** Null on the podium. `correct` is null until the round is over. */
  question: {
    text: string;
    options: string[];
    time: number;
    correct: number | null;
  } | null;
  /** Milliseconds left in the question phase, measured when this was sent. */
  leftMs: number;
  board: GameBoardEntry[];
  answered: number;
  playerCount: number;
  /** Answers per option. Host only, results phase only. */
  counts: number[] | null;
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
  choice: number;
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
