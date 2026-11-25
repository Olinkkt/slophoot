import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUIZ_ERRORS, validateQuizInput } from "./quiz";

const question = { text: " Q? ", options: ["a", "b", " c ", "d"], correct: 0, time: 20 };

describe("validateQuizInput", () => {
  it("accepts a valid quiz and trims text", () => {
    const result = validateQuizInput({ title: "  My  quiz ", questions: [question] });
    assert.deepEqual(result, {
      ok: true,
      quiz: {
        title: "My quiz",
        questions: [{ text: "Q?", options: ["a", "b", "c", "d"], correct: 0, time: 20 }],
      },
    });
  });

  it("rejects malformed input", () => {
    const bad: unknown[] = [
      null,
      "x",
      {},
      { title: "", questions: [question] },
      { title: "T", questions: [] },
      { title: "T", questions: "no" },
      { title: "T", questions: [null] },
      { title: "T", questions: [{ ...question, text: "  " }] },
      { title: "T", questions: [{ ...question, options: ["a", "b", "c"] }] },
      { title: "T", questions: [{ ...question, options: ["a", "b", "c", " "] }] },
      { title: "T", questions: [{ ...question, options: ["a", "b", "c", 4] }] },
      { title: "T", questions: [{ ...question, correct: 4 }] },
      { title: "T", questions: [{ ...question, correct: -1 }] },
      { title: "T", questions: [{ ...question, correct: 0.5 }] },
      { title: "T", questions: [{ ...question, time: 4 }] },
      { title: "T", questions: [{ ...question, time: 121 }] },
      { title: "T", questions: [{ ...question, time: "20" }] },
    ];
    for (const input of bad) {
      assert.deepEqual(validateQuizInput(input), { ok: false, message: QUIZ_ERRORS.invalid });
    }
  });

  it("rejects oversized content", () => {
    assert.deepEqual(validateQuizInput({ title: "x".repeat(101), questions: [question] }), {
      ok: false,
      message: QUIZ_ERRORS.tooLong,
    });
    assert.deepEqual(
      validateQuizInput({ title: "T", questions: [{ ...question, text: "x".repeat(201) }] }),
      { ok: false, message: QUIZ_ERRORS.tooLong },
    );
    assert.deepEqual(
      validateQuizInput({ title: "T", questions: Array.from({ length: 51 }, () => question) }),
      { ok: false, message: QUIZ_ERRORS.tooMany },
    );
  });
});
