import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { QuizInput, QuizQuestion, QuizSummary } from "../shared/events";
import { randomUUID } from "node:crypto";

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
      options: ["Lyon", "Paris", "Marseille", "Nice"],
      correct: 1,
      time: 15,
    },
    {
      text: "What is 7 × 8?",
      options: ["54", "56", "58", "64"],
      correct: 1,
      time: 15,
    },
    {
      text: "Which planet is closest to the Sun?",
      options: ["Venus", "Earth", "Mercury", "Mars"],
      correct: 2,
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

  function count(): number {
    const row = countStatement.get() as { total: number } | undefined;
    return Number(row?.total ?? 0);
  }

  function parseQuestions(raw: unknown): QuizQuestion[] {
    try {
      const parsed: unknown = JSON.parse(String(raw));
      return Array.isArray(parsed) ? (parsed as QuizQuestion[]) : [];
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
