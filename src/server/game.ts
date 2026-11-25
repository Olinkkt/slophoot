import type {
  AnswerValue,
  GameBoardEntry,
  GamePhase,
  GameQuestion,
  GameState,
  QuestionReveal,
  QuizQuestion,
} from "../shared/events";
import { acceptAnswer, grade, identity, shuffled, type Shuffle } from "./grading";

export type GameQuiz = {
  title: string;
  questions: QuizQuestion[];
};

export type GameViewer = "host" | { socketId: string };

export type GameManagerOptions = {
  now?: () => number;
  /** Called after any state change, including timer-driven ones. */
  onChange: (pin: string) => void;
  /** Called after the host leaves the podium. The game is already disposed. */
  onEnd: (pin: string) => void;
};

export type GameManager = {
  start: (pin: string, quiz: GameQuiz, players: Array<{ socketId: string; nickname: string }>) => boolean;
  has: (pin: string) => boolean;
  answer: (pin: string, socketId: string, choice: unknown) => void;
  next: (pin: string) => void;
  removePlayer: (pin: string, socketId: string) => void;
  dispose: (pin: string) => void;
  disposeAll: () => void;
  stateFor: (pin: string, viewer: GameViewer) => GameState | null;
};

type PlayerState = {
  nickname: string;
  score: number;
  streak: number;
  choice: AnswerValue | null;
  answeredAt: number;
  gained: number;
  /** Null for polls and before the round ends. */
  correct: boolean | null;
};

type Game = {
  pin: string;
  quiz: GameQuiz;
  phase: GamePhase;
  index: number;
  startedAt: number;
  /** How the current question's items are shown. Identity for question types that are not shuffled. */
  shuffle: Shuffle;
  timer: ReturnType<typeof setTimeout> | null;
  players: Map<string, PlayerState>;
};

export const BOARD_SIZE = 10;
const BASE_POINTS = 1000;
const STREAK_BONUS = 100;
const STREAK_BONUS_CAP = 5;

/**
 * Full points for an instant answer, down to half points at the buzzer, plus a streak bonus.
 * `credit` (0 to 1) scales the time points for partly right answers.
 */
export function pointsFor(elapsedMs: number, timeSeconds: number, streak: number, credit = 1): number {
  const limit = timeSeconds * 1000;
  const ratio = Math.min(Math.max(elapsedMs / limit, 0), 1);
  const base = Math.round(BASE_POINTS * (1 - 0.5 * ratio) * credit);
  const bonus = Math.min(Math.max(streak - 1, 0), STREAK_BONUS_CAP) * STREAK_BONUS;
  return base + bonus;
}

const POINTS_MULTIPLIER = { standard: 1, double: 2, none: 0 } as const;

function shuffleLength(question: QuizQuestion): number {
  if (question.type === "order") {
    return question.items.length;
  }
  return question.type === "pairs" ? question.pairs.length : 0;
}

function revealFor(question: QuizQuestion): QuestionReveal {
  switch (question.type) {
    case "choice":
      return { type: "choice", correct: question.correct };
    case "multi":
      return { type: "multi", correct: question.correct };
    case "text":
      return { type: "text", answers: question.answers };
    case "slider":
      return { type: "slider", correct: question.correct, tolerance: question.tolerance };
    case "order":
      return { type: "order", items: question.items };
    case "pairs":
      return { type: "pairs", pairs: question.pairs };
    case "poll":
      return { type: "poll" };
  }
}

function viewQuestion(question: QuizQuestion, shuffle: Shuffle, over: boolean): GameQuestion {
  const view: GameQuestion = {
    type: question.type,
    text: question.text,
    time: question.time,
    points: question.points,
    image: question.image ?? null,
    options: [],
    items: [],
    matches: [],
    range: null,
    reveal: over ? revealFor(question) : null,
    explanation: over ? (question.explanation ?? null) : null,
  };

  switch (question.type) {
    case "choice":
    case "multi":
    case "poll":
      view.options = question.options;
      break;
    case "slider":
      view.range = { min: question.min, max: question.max };
      break;
    case "order":
      view.items = shuffle.map((authored) => question.items[authored] ?? "");
      break;
    case "pairs":
      view.items = question.pairs.map((pair) => pair.left);
      view.matches = shuffle.map((authored) => question.pairs[authored]?.right ?? "");
      break;
    case "text":
      break;
  }
  return view;
}

export function createGameManager(options: GameManagerOptions): GameManager {
  const now = options.now ?? Date.now;
  const games = new Map<string, Game>();

  function ranked(game: Game): Array<[string, PlayerState]> {
    // Array.prototype.sort is stable, so ties keep join order.
    return [...game.players.entries()].sort((a, b) => b[1].score - a[1].score);
  }

  function stopTimer(game: Game): void {
    if (game.timer !== null) {
      clearTimeout(game.timer);
      game.timer = null;
    }
  }

  function everyoneAnswered(game: Game): boolean {
    return game.players.size > 0 && [...game.players.values()].every((p) => p.choice !== null);
  }

  function endRound(game: Game): void {
    if (game.phase !== "question") {
      return;
    }

    stopTimer(game);
    const question = game.quiz.questions[game.index];
    if (!question) {
      return;
    }

    const multiplier = POINTS_MULTIPLIER[question.points];
    for (const player of game.players.values()) {
      if (player.choice === null) {
        // No answer. A skipped poll leaves the streak alone, anything else breaks it.
        player.correct = question.type === "poll" ? null : false;
        player.streak = question.type === "poll" ? player.streak : 0;
        player.gained = 0;
        continue;
      }

      const result = grade(question, player.choice, game.shuffle);
      player.correct = result.correct;
      if (result.correct === null) {
        player.gained = 0;
        continue;
      }

      player.streak = result.correct ? player.streak + 1 : 0;
      const elapsed = player.answeredAt - game.startedAt;
      const earned = pointsFor(elapsed, question.time, result.correct ? player.streak : 0, result.credit);
      player.gained = Math.round(earned * multiplier);
      player.score += player.gained;
    }

    game.phase = "results";
    options.onChange(game.pin);
  }

  function ask(game: Game): void {
    const question = game.quiz.questions[game.index];
    if (!question) {
      return;
    }

    stopTimer(game);
    game.phase = "question";
    game.startedAt = now();
    const length = shuffleLength(question);
    game.shuffle = length > 0 ? shuffled(length) : identity(0);
    for (const player of game.players.values()) {
      player.choice = null;
      player.gained = 0;
      player.correct = null;
    }

    game.timer = setTimeout(() => {
      game.timer = null;
      if (games.get(game.pin) === game) {
        endRound(game);
      }
    }, question.time * 1000);
    game.timer.unref();
    options.onChange(game.pin);
  }

  function start(
    pin: string,
    quiz: GameQuiz,
    players: Array<{ socketId: string; nickname: string }>,
  ): boolean {
    if (games.has(pin) || quiz.questions.length === 0 || players.length === 0) {
      return false;
    }

    const game: Game = {
      pin,
      quiz,
      phase: "question",
      index: 0,
      startedAt: 0,
      shuffle: [],
      timer: null,
      players: new Map(
        players.map((player) => [
          player.socketId,
          {
            nickname: player.nickname,
            score: 0,
            streak: 0,
            choice: null,
            answeredAt: 0,
            gained: 0,
            correct: null,
          },
        ]),
      ),
    };
    games.set(pin, game);
    ask(game);
    return true;
  }

  function answer(pin: string, socketId: string, choice: unknown): void {
    const game = games.get(pin);
    const player = game?.players.get(socketId);
    if (!game || !player || game.phase !== "question" || player.choice !== null) {
      return;
    }

    const question = game.quiz.questions[game.index];
    const accepted = question ? acceptAnswer(question, choice) : null;
    if (!question || accepted === null) {
      return;
    }

    const at = now();
    if (at - game.startedAt > question.time * 1000) {
      return;
    }

    player.choice = accepted;
    player.answeredAt = at;
    if (everyoneAnswered(game)) {
      endRound(game);
      return;
    }

    options.onChange(pin);
  }

  function next(pin: string): void {
    const game = games.get(pin);
    if (!game) {
      return;
    }

    if (game.phase === "question") {
      endRound(game);
      return;
    }

    if (game.phase === "results") {
      if (game.index + 1 < game.quiz.questions.length) {
        game.index += 1;
        ask(game);
      } else {
        game.phase = "podium";
        options.onChange(pin);
      }
      return;
    }

    dispose(pin);
    options.onEnd(pin);
  }

  function removePlayer(pin: string, socketId: string): void {
    const game = games.get(pin);
    if (!game || !game.players.delete(socketId)) {
      return;
    }

    if (game.phase === "question" && everyoneAnswered(game)) {
      endRound(game);
      return;
    }

    options.onChange(pin);
  }

  function dispose(pin: string): void {
    const game = games.get(pin);
    if (!game) {
      return;
    }

    stopTimer(game);
    games.delete(pin);
  }

  function disposeAll(): void {
    for (const pin of [...games.keys()]) {
      dispose(pin);
    }
  }

  function countOptions(game: Game, question: QuizQuestion): number[] | null {
    if (question.type !== "choice" && question.type !== "multi" && question.type !== "poll") {
      return null;
    }

    return question.options.map((_, optionIndex) =>
      [...game.players.values()].filter((player) =>
        Array.isArray(player.choice) ? player.choice.includes(optionIndex) : player.choice === optionIndex,
      ).length,
    );
  }

  function stateFor(pin: string, viewer: GameViewer): GameState | null {
    const game = games.get(pin);
    if (!game) {
      return null;
    }

    const order = ranked(game);
    const question = game.quiz.questions[game.index];
    const showAnswer = game.phase === "results";
    const board: GameBoardEntry[] = order
      .slice(0, BOARD_SIZE)
      .map(([, player]) => ({ nickname: player.nickname, score: player.score }));

    let me: GameState["me"] = null;
    if (viewer !== "host") {
      const index = order.findIndex(([socketId]) => socketId === viewer.socketId);
      const player = game.players.get(viewer.socketId);
      if (!player || index < 0) {
        return null;
      }

      me = {
        nickname: player.nickname,
        score: player.score,
        rank: index + 1,
        choice: player.choice,
        answered: player.choice !== null,
        correct: showAnswer ? player.correct : null,
        gained: showAnswer ? player.gained : 0,
      };
    }

    const inQuestion = game.phase !== "podium" && question !== undefined;
    return {
      pin,
      phase: game.phase,
      title: game.quiz.title,
      index: game.index,
      total: game.quiz.questions.length,
      question: inQuestion ? viewQuestion(question, game.shuffle, showAnswer) : null,
      leftMs:
        game.phase === "question" && question
          ? Math.max(0, game.startedAt + question.time * 1000 - now())
          : 0,
      board,
      answered: [...game.players.values()].filter((player) => player.choice !== null).length,
      playerCount: game.players.size,
      counts: viewer === "host" && showAnswer && question ? countOptions(game, question) : null,
      correctCount:
        viewer === "host" && showAnswer && question && question.type !== "poll"
          ? [...game.players.values()].filter((player) => player.correct === true).length
          : null,
      me,
    };
  }

  return {
    start,
    has: (pin) => games.has(pin),
    answer,
    next,
    removePlayer,
    dispose,
    disposeAll,
    stateFor,
  };
}
