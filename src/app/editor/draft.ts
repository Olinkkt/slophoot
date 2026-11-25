import type { PointsMode, QuestionType } from "@/shared/events";
import { QUESTION_TIME_DEFAULT } from "@/shared/quiz";

/** True / false is a two-option choice question with the options fixed. */
export type DraftType = QuestionType | "truefalse";

export type Draft = {
  key: number;
  type: DraftType;
  text: string;
  time: string;
  points: PointsMode;
  explanation: string;
  image: string;
  /** Choice, multi, and poll. */
  options: string[];
  /** Choice and true / false: the right option. */
  correct: number;
  /** Multi: every right option. */
  corrects: number[];
  /** Text: accepted answers. */
  answers: string[];
  min: string;
  max: string;
  target: string;
  tolerance: string;
  /** Order: the items in the right order. */
  items: string[];
  pairs: Array<{ left: string; right: string }>;
};

export const TYPE_LABELS: Record<DraftType, string> = {
  choice: "Multiple choice",
  truefalse: "True / False",
  multi: "Multiple answers",
  text: "Type the answer",
  slider: "Number slider",
  order: "Put in order",
  pairs: "Match pairs",
  poll: "Poll (no points)",
};

export const TYPE_HINTS: Record<DraftType, string> = {
  choice: "Players pick one answer.",
  truefalse: "Players pick true or false.",
  multi: "Players tick every right answer. Wrong ticks cost points.",
  text: "Players type the answer. Case, accents, and small typos still count.",
  slider: "Players guess a number. The closer, the more points.",
  order: "Players put the items in the right order. List them in the right order here.",
  pairs: "Players match each left item to its right item.",
  poll: "Players vote. There is no right answer and no points.",
};

export function blankDraft(key: number, type: DraftType = "choice"): Draft {
  return {
    key,
    type,
    text: "",
    time: String(QUESTION_TIME_DEFAULT),
    points: "standard",
    explanation: "",
    image: "",
    options: ["", "", "", ""],
    correct: 0,
    corrects: [],
    answers: [""],
    min: "0",
    max: "100",
    target: "50",
    tolerance: "5",
    items: ["", "", ""],
    pairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
  };
}

function num(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/** The draft as the quiz API expects it. `validateQuizInput` does the real checking. */
export function toQuestionInput(draft: Draft): Record<string, unknown> {
  const base = {
    text: draft.text,
    time: num(draft.time),
    points: draft.points,
    explanation: draft.explanation,
    image: draft.image,
  };

  switch (draft.type) {
    case "truefalse":
      return { ...base, type: "choice", options: ["True", "False"], correct: draft.correct };
    case "choice":
      return { ...base, type: "choice", options: draft.options, correct: draft.correct };
    case "multi":
      return { ...base, type: "multi", options: draft.options, correct: draft.corrects };
    case "text":
      return { ...base, type: "text", answers: draft.answers };
    case "slider":
      return {
        ...base,
        type: "slider",
        min: num(draft.min),
        max: num(draft.max),
        correct: num(draft.target),
        tolerance: num(draft.tolerance),
      };
    case "order":
      return { ...base, type: "order", items: draft.items };
    case "pairs":
      return { ...base, type: "pairs", pairs: draft.pairs };
    case "poll":
      return { ...base, type: "poll", options: draft.options };
  }
}
