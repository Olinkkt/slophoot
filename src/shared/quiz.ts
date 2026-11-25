import type { PointsMode, QuestionType, QuizInput, QuizQuestion } from "./events";

export const QUIZ_TITLE_MAX = 100;
export const QUIZ_QUESTIONS_MAX = 50;
export const QUESTION_TEXT_MAX = 200;
export const OPTION_TEXT_MAX = 100;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 4;
export const ITEMS_MIN = 2;
export const ITEMS_MAX = 5;
export const TEXT_ANSWERS_MAX = 5;
export const TEXT_ANSWER_MAX = 60;
/** Longest answer a player can type. */
export const TEXT_INPUT_MAX = 100;
export const QUESTION_TIME_MIN = 5;
export const QUESTION_TIME_MAX = 120;
export const QUESTION_TIME_DEFAULT = 20;
export const EXPLANATION_MAX = 200;
export const IMAGE_URL_MAX = 500;
export const NUMBER_LIMIT = 1_000_000_000;

export const QUESTION_TYPES: readonly QuestionType[] = [
  "choice",
  "multi",
  "text",
  "slider",
  "order",
  "pairs",
  "poll",
];
export const POINTS_MODES: readonly PointsMode[] = ["standard", "double", "none"];

export const QUIZ_ERRORS = {
  invalid:
    "Enter a title and at least one complete question, with a time of 5 to 120 seconds each.",
  tooLong: "A title, question, answer, or link is too long.",
  tooMany: "A quiz can have at most 50 questions.",
} as const;

export type QuizValidation =
  | { ok: true; quiz: QuizInput }
  | { ok: false; message: string };

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const INVALID = { ok: false, message: QUIZ_ERRORS.invalid } as const;
const TOO_LONG = { ok: false, message: QUIZ_ERRORS.tooLong } as const;

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

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** Cleans a list of strings. Fails when the count is off or any entry is blank or too long. */
function cleanList(
  value: unknown,
  min: number,
  max: number,
  maxLength: number,
): Checked<string[]> {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    return INVALID;
  }

  const list: string[] = [];
  for (const entry of value as unknown[]) {
    const text = cleanText(entry);
    if (text === null) {
      return INVALID;
    }
    if (length(text) > maxLength) {
      return TOO_LONG;
    }
    list.push(text);
  }

  return { ok: true, value: list };
}

function cleanImage(value: unknown): Checked<string | undefined> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }

  const text = typeof value === "string" ? value.trim() : null;
  if (text === null) {
    return INVALID;
  }
  if (length(text) > IMAGE_URL_MAX) {
    return TOO_LONG;
  }

  try {
    const url = new URL(text);
    if (url.protocol !== "https:") {
      return INVALID;
    }
  } catch {
    return INVALID;
  }

  return { ok: true, value: text };
}

function validateQuestion(raw: unknown): Checked<QuizQuestion> {
  if (typeof raw !== "object" || raw === null) {
    return INVALID;
  }

  const entry = raw as Record<string, unknown>;
  const text = cleanText(entry.text);
  const type = entry.type === undefined ? "choice" : entry.type;
  const points = entry.points === undefined ? "standard" : entry.points;
  if (
    text === null ||
    !QUESTION_TYPES.includes(type as QuestionType) ||
    !POINTS_MODES.includes(points as PointsMode) ||
    !isInt(entry.time, QUESTION_TIME_MIN, QUESTION_TIME_MAX)
  ) {
    return INVALID;
  }
  if (length(text) > QUESTION_TEXT_MAX) {
    return TOO_LONG;
  }

  const image = cleanImage(entry.image);
  if (!image.ok) {
    return image;
  }

  let explanation: string | undefined;
  if (entry.explanation !== undefined && entry.explanation !== null && entry.explanation !== "") {
    const cleaned = cleanText(entry.explanation);
    if (cleaned === null) {
      return INVALID;
    }
    if (length(cleaned) > EXPLANATION_MAX) {
      return TOO_LONG;
    }
    explanation = cleaned;
  }

  const base = {
    text,
    time: entry.time,
    points: points as PointsMode,
    ...(image.value === undefined ? {} : { image: image.value }),
    ...(explanation === undefined ? {} : { explanation }),
  };

  switch (type as QuestionType) {
    case "choice": {
      const options = cleanList(entry.options, OPTIONS_MIN, OPTIONS_MAX, OPTION_TEXT_MAX);
      if (!options.ok) {
        return options;
      }
      if (!isInt(entry.correct, 0, options.value.length - 1)) {
        return INVALID;
      }
      return { ok: true, value: { ...base, type: "choice", options: options.value, correct: entry.correct } };
    }

    case "multi": {
      const options = cleanList(entry.options, OPTIONS_MIN, OPTIONS_MAX, OPTION_TEXT_MAX);
      if (!options.ok) {
        return options;
      }
      const correct = entry.correct;
      if (
        !Array.isArray(correct) ||
        correct.length === 0 ||
        !correct.every((index) => isInt(index, 0, options.value.length - 1)) ||
        new Set(correct).size !== correct.length
      ) {
        return INVALID;
      }
      const sorted = [...(correct as number[])].sort((a, b) => a - b);
      return { ok: true, value: { ...base, type: "multi", options: options.value, correct: sorted } };
    }

    case "text": {
      const answers = cleanList(entry.answers, 1, TEXT_ANSWERS_MAX, TEXT_ANSWER_MAX);
      if (!answers.ok) {
        return answers;
      }
      return { ok: true, value: { ...base, type: "text", answers: answers.value } };
    }

    case "slider": {
      const { min, max, correct, tolerance } = entry;
      if (
        !isInt(min, -NUMBER_LIMIT, NUMBER_LIMIT) ||
        !isInt(max, -NUMBER_LIMIT, NUMBER_LIMIT) ||
        max <= min ||
        !isInt(correct, min, max) ||
        !isInt(tolerance, 0, max - min)
      ) {
        return INVALID;
      }
      return { ok: true, value: { ...base, type: "slider", min, max, correct, tolerance } };
    }

    case "order": {
      const items = cleanList(entry.items, ITEMS_MIN, ITEMS_MAX, OPTION_TEXT_MAX);
      if (!items.ok) {
        return items;
      }
      return { ok: true, value: { ...base, type: "order", items: items.value } };
    }

    case "pairs": {
      if (!Array.isArray(entry.pairs) || entry.pairs.length < ITEMS_MIN || entry.pairs.length > ITEMS_MAX) {
        return INVALID;
      }
      const lefts: unknown[] = [];
      const rights: unknown[] = [];
      for (const pair of entry.pairs as unknown[]) {
        if (typeof pair !== "object" || pair === null) {
          return INVALID;
        }
        lefts.push((pair as Record<string, unknown>).left);
        rights.push((pair as Record<string, unknown>).right);
      }
      const left = cleanList(lefts, ITEMS_MIN, ITEMS_MAX, OPTION_TEXT_MAX);
      const right = cleanList(rights, ITEMS_MIN, ITEMS_MAX, OPTION_TEXT_MAX);
      if (!left.ok) {
        return left;
      }
      if (!right.ok) {
        return right;
      }
      // Two equal right-hand items could not be told apart when players match them.
      if (new Set(right.value.map((value) => value.toLowerCase())).size !== right.value.length) {
        return INVALID;
      }
      return {
        ok: true,
        value: {
          ...base,
          type: "pairs",
          pairs: left.value.map((item, index) => ({ left: item, right: right.value[index] ?? "" })),
        },
      };
    }

    case "poll": {
      const options = cleanList(entry.options, OPTIONS_MIN, OPTIONS_MAX, OPTION_TEXT_MAX);
      if (!options.ok) {
        return options;
      }
      return { ok: true, value: { ...base, type: "poll", points: "none", options: options.value } };
    }
  }
}

export function validateQuizInput(input: unknown): QuizValidation {
  if (typeof input !== "object" || input === null) {
    return INVALID;
  }

  const record = input as Record<string, unknown>;
  const title = cleanText(record.title);
  if (title === null || !Array.isArray(record.questions) || record.questions.length === 0) {
    return INVALID;
  }

  if (record.questions.length > QUIZ_QUESTIONS_MAX) {
    return { ok: false, message: QUIZ_ERRORS.tooMany };
  }

  if (length(title) > QUIZ_TITLE_MAX) {
    return TOO_LONG;
  }

  const questions: QuizQuestion[] = [];
  for (const raw of record.questions as unknown[]) {
    const result = validateQuestion(raw);
    if (!result.ok) {
      return result;
    }
    questions.push(result.value);
  }

  return { ok: true, quiz: { title, questions } };
}
