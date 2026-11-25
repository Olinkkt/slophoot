import type { AnswerValue, QuizQuestion } from "../shared/events";
import { TEXT_INPUT_MAX } from "../shared/quiz";


export type Grade = {
  /** Null for polls, which have no right answer. */
  correct: boolean | null;
  /** 0 to 1. Scales the time-based points. */
  credit: number;
};

/**
 * How a question's items are shown. `shown[i]` is the authored index of the item
 * displayed in slot `i`. Only order and pairs questions are shuffled.
 */
export type Shuffle = number[];

export function identity(length: number): Shuffle {
  return Array.from({ length }, (_, index) => index);
}

/** Fisher-Yates, then rotated by one if it came out unchanged so the puzzle is never pre-solved. */
export function shuffled(length: number, random: () => number = Math.random): Shuffle {
  const order = identity(length);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const held = order[i] ?? 0;
    order[i] = order[j] ?? 0;
    order[j] = held;
  }

  if (length > 1 && order.every((value, index) => value === index)) {
    order.push(order.shift() ?? 0);
  }
  return order;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = row;
  }
  return previous[right.length] ?? 0;
}

/** Case, accents, and punctuation never matter. Longer answers also forgive a typo or two. */
export function matchesText(input: string, accepted: readonly string[]): boolean {
  const guess = normalizeText(input);
  if (guess.length === 0) {
    return false;
  }

  return accepted.some((answer) => {
    const target = normalizeText(answer);
    const forgiven = target.length >= 9 ? 2 : target.length >= 5 ? 1 : 0;
    return editDistance(guess, target) <= forgiven;
  });
}

function isIndexList(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry < length) &&
    new Set(value).size === length
  );
}

/** Returns the answer in its stored form, or null when it does not fit the question. */
export function acceptAnswer(question: QuizQuestion, answer: unknown): AnswerValue | null {
  switch (question.type) {
    case "choice":
    case "poll":
      return typeof answer === "number" &&
        Number.isInteger(answer) &&
        answer >= 0 &&
        answer < question.options.length
        ? answer
        : null;

    case "multi": {
      if (
        !Array.isArray(answer) ||
        answer.length === 0 ||
        answer.length > question.options.length ||
        new Set(answer).size !== answer.length ||
        !answer.every(
          (entry) =>
            typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry < question.options.length,
        )
      ) {
        return null;
      }
      return [...(answer as number[])].sort((a, b) => a - b);
    }

    case "text": {
      if (typeof answer !== "string") {
        return null;
      }
      const text = answer.replace(/\s+/gu, " ").trim();
      return text.length > 0 && Array.from(text).length <= TEXT_INPUT_MAX ? text : null;
    }

    case "slider":
      return typeof answer === "number" &&
        Number.isFinite(answer) &&
        answer >= question.min &&
        answer <= question.max
        ? answer
        : null;

    case "order":
      return isIndexList(answer, question.items.length) ? answer : null;

    case "pairs":
      return isIndexList(answer, question.pairs.length) ? answer : null;
  }
}

/** Grades an answer that `acceptAnswer` already accepted. */
export function grade(question: QuizQuestion, answer: AnswerValue, shuffle: Shuffle): Grade {
  switch (question.type) {
    case "poll":
      return { correct: null, credit: 0 };

    case "choice":
      return answer === question.correct ? { correct: true, credit: 1 } : { correct: false, credit: 0 };

    case "multi": {
      const picked = answer as number[];
      const right = picked.filter((index) => question.correct.includes(index)).length;
      const wrong = picked.length - right;
      const credit = Math.max(0, (right - wrong) / question.correct.length);
      return { correct: right === question.correct.length && wrong === 0, credit };
    }

    case "text": {
      const hit = matchesText(answer as string, question.answers);
      return { correct: hit, credit: hit ? 1 : 0 };
    }

    case "slider": {
      const distance = Math.abs((answer as number) - question.correct);
      if (distance > question.tolerance) {
        return { correct: false, credit: 0 };
      }
      // Full credit on the exact number, half at the edge of the tolerance.
      const credit = question.tolerance > 0 ? 1 - 0.5 * (distance / question.tolerance) : 1;
      return { correct: true, credit };
    }

    case "order": {
      const placed = answer as number[];
      const hits = placed.filter((shown, position) => shuffle[shown] === position).length;
      return { correct: hits === placed.length, credit: hits / placed.length };
    }

    case "pairs": {
      const matched = answer as number[];
      const hits = matched.filter((shown, left) => shuffle[shown] === left).length;
      return { correct: hits === matched.length, credit: hits / matched.length };
    }
  }
}
