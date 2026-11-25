import type { QuizInput, QuizQuestion } from "./events";

export const QUIZ_TITLE_MAX = 100;
export const QUIZ_QUESTIONS_MAX = 50;
export const QUESTION_TEXT_MAX = 200;
export const OPTION_TEXT_MAX = 100;
export const OPTION_COUNT = 4;
export const QUESTION_TIME_MIN = 5;
export const QUESTION_TIME_MAX = 120;
export const QUESTION_TIME_DEFAULT = 20;

export const QUIZ_ERRORS = {
  invalid: "Enter a title, at least one question, and all four answers (5 to 120 seconds each).",
  tooLong: "A title, question, or answer is too long.",
  tooMany: "A quiz can have at most 50 questions.",
} as const;

export type QuizValidation =
  | { ok: true; quiz: QuizInput }
  | { ok: false; message: string };

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.replace(/\s+/gu, " ").trim();
  return text.length > 0 ? text : null;
}

function length(value: string): number {
  return Array.from(value).length;
}

export function validateQuizInput(input: unknown): QuizValidation {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: QUIZ_ERRORS.invalid };
  }

  const record = input as Record<string, unknown>;
  const title = cleanText(record.title);
  if (title === null || !Array.isArray(record.questions) || record.questions.length === 0) {
    return { ok: false, message: QUIZ_ERRORS.invalid };
  }

  if (record.questions.length > QUIZ_QUESTIONS_MAX) {
    return { ok: false, message: QUIZ_ERRORS.tooMany };
  }

  if (length(title) > QUIZ_TITLE_MAX) {
    return { ok: false, message: QUIZ_ERRORS.tooLong };
  }

  const questions: QuizQuestion[] = [];
  for (const raw of record.questions as unknown[]) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, message: QUIZ_ERRORS.invalid };
    }

    const entry = raw as Record<string, unknown>;
    const text = cleanText(entry.text);
    const { options, correct, time } = entry;
    if (
      text === null ||
      !Array.isArray(options) ||
      options.length !== OPTION_COUNT ||
      typeof correct !== "number" ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= OPTION_COUNT ||
      typeof time !== "number" ||
      !Number.isInteger(time) ||
      time < QUESTION_TIME_MIN ||
      time > QUESTION_TIME_MAX
    ) {
      return { ok: false, message: QUIZ_ERRORS.invalid };
    }

    const cleanOptions: string[] = [];
    for (const option of options as unknown[]) {
      const value = cleanText(option);
      if (value === null) {
        return { ok: false, message: QUIZ_ERRORS.invalid };
      }
      cleanOptions.push(value);
    }

    if (
      length(text) > QUESTION_TEXT_MAX ||
      cleanOptions.some((option) => length(option) > OPTION_TEXT_MAX)
    ) {
      return { ok: false, message: QUIZ_ERRORS.tooLong };
    }

    questions.push({ text, options: cleanOptions, correct, time });
  }

  return { ok: true, quiz: { title, questions } };
}
