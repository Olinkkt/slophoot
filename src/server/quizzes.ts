import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { QuizInput, QuizQuestion, QuizSummary } from "../shared/events";
import { randomUUID } from "node:crypto";
import { validateQuizInput } from "../shared/quiz";

export type StoredQuiz = {
  id: string;
  title: string;
  questions: QuizQuestion[];
};

export type QuizStore = {
  list: () => QuizSummary[];
  get: (id: string) => StoredQuiz | null;
  create: (input: QuizInput) => string;
  count: () => number;
};

export const MAX_STORED_QUIZZES = 200;

const DEMO_QUIZ: QuizInput = {
  title: "Demo quiz",
  questions: [
    {
      text: "What is the capital of France?",
      type: "choice",
      points: "standard",
      options: ["Lyon", "Paris", "Marseille", "Nice"],
      correct: 1,
      time: 15,
    },
    {
      text: "What is 7 × 8?",
      type: "choice",
      points: "standard",
      options: ["54", "56", "58", "64"],
      correct: 1,
      time: 15,
    },
    {
      text: "Which planet is closest to the Sun?",
      type: "choice",
      points: "standard",
      options: ["Venus", "Earth", "Mercury", "Mars"],
      correct: 2,
      time: 15,
    },
  ],
};

const DEMO_QUIZ_ALL_TYPES: QuizInput = {
  title: "Demo quiz #2",
  questions: [
    {
      type: "choice",
      points: "standard",
      text: "What is the largest ocean on Earth?",
      options: ["Atlantic", "Indian", "Pacific", "Arctic"],
      correct: 2,
      time: 15,
    },
    {
      type: "choice",
      points: "standard",
      text: "A tomato is botanically a fruit.",
      options: ["True", "False"],
      correct: 0,
      time: 10,
      explanation: "Tomatoes grow from a flower and hold seeds, which makes them fruit.",
    },
    {
      type: "multi",
      points: "standard",
      text: "Which of these are prime numbers?",
      options: ["2", "9", "11", "15"],
      correct: [0, 2],
      time: 20,
    },
    {
      type: "text",
      points: "standard",
      text: "What is the capital of Japan?",
      answers: ["Tokyo"],
      time: 20,
    },
    {
      type: "slider",
      points: "double",
      text: "In what year did humans first land on the Moon?",
      min: 1900,
      max: 2020,
      correct: 1969,
      tolerance: 5,
      time: 25,
      explanation: "Apollo 11 landed on July 20, 1969.",
    },
    {
      type: "order",
      points: "standard",
      text: "Put these planets in order, starting closest to the Sun.",
      items: ["Mercury", "Venus", "Earth", "Mars"],
      time: 30,
    },
    {
      type: "pairs",
      points: "standard",
      text: "Match each country with its capital.",
      pairs: [
        { left: "France", right: "Paris" },
        { left: "Italy", right: "Rome" },
        { left: "Spain", right: "Madrid" },
      ],
      time: 30,
    },
    {
      type: "poll",
      points: "none",
      text: "What should we eat after the quiz?",
      options: ["Pizza", "Tacos", "Sushi", "Burgers"],
      time: 15,
    },
  ],
};

export function createQuizStore(path: string): QuizStore {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions TEXT NOT NULL, created_at INTEGER NOT NULL)",
  );

  const countStatement = db.prepare("SELECT COUNT(*) AS total FROM quizzes");
  const insertStatement = db.prepare(
    "INSERT INTO quizzes (id, title, questions, created_at) VALUES (?, ?, ?, ?)",
  );
  const listStatement = db.prepare("SELECT id, title, questions FROM quizzes ORDER BY created_at, rowid");
  const getStatement = db.prepare("SELECT id, title, questions FROM quizzes WHERE id = ?");
  const titleStatement = db.prepare("SELECT 1 AS found FROM quizzes WHERE title = ? LIMIT 1");

  function count(): number {
    const row = countStatement.get() as { total: number } | undefined;
    return Number(row?.total ?? 0);
  }

  function parseQuestions(raw: unknown): QuizQuestion[] {
    try {
      const parsed: unknown = JSON.parse(String(raw));
      if (!Array.isArray(parsed)) {
        return [];
      }

      // Quizzes saved before question types existed have neither `type` nor `points`.
      const result = validateQuizInput({ title: "stored", questions: parsed });
      return result.ok ? result.quiz.questions : [];
    } catch {
      return [];
    }
  }

  function create(input: QuizInput): string {
    const id = randomUUID();
    insertStatement.run(id, input.title, JSON.stringify(input.questions), Date.now());
    return id;
  }

  function list(): QuizSummary[] {
    const rows = listStatement.all() as Array<{ id: string; title: string; questions: string }>;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      questionCount: parseQuestions(row.questions).length,
    }));
  }

  function get(id: string): StoredQuiz | null {
    const row = getStatement.get(id) as { id: string; title: string; questions: string } | undefined;
    if (!row) {
      return null;
    }

    const questions = parseQuestions(row.questions);
    if (questions.length === 0) {
      return null;
    }

    return { id: row.id, title: row.title, questions };
  }

  if (count() === 0) {
    create(DEMO_QUIZ);
  }

  // Added after the first release, so existing databases get it too.
  if (!titleStatement.get(DEMO_QUIZ_ALL_TYPES.title)) {
    create(DEMO_QUIZ_ALL_TYPES);
  }

  return { list, get, create, count };
}

const globalForQuizzes = globalThis as typeof globalThis & { __slophootQuizStore?: QuizStore };

/** One shared store per process, even when Next and the game server load this module separately. */
export function getQuizStore(): QuizStore {
  globalForQuizzes.__slophootQuizStore ??= createQuizStore(
    process.env.DB_PATH && process.env.DB_PATH.length > 0 ? process.env.DB_PATH : "data/slophoot.db",
  );
  return globalForQuizzes.__slophootQuizStore;
}
