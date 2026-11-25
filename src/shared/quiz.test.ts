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
        questions: [
          { type: "choice", points: "standard", text: "Q?", options: ["a", "b", "c", "d"], correct: 0, time: 20 },
        ],
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
      { title: "T", questions: [{ ...question, options: ["a"] }] },
      { title: "T", questions: [{ ...question, options: ["a", "b", "c", "d", "e"] }] },
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

  const base = { text: "Q?", time: 20 };
  const quizOf = (extra: Record<string, unknown>) => ({ title: "T", questions: [{ ...base, ...extra }] });

  it("accepts every question type", () => {
    const good: Array<Record<string, unknown>> = [
      { type: "choice", options: ["True", "False"], correct: 1 },
      { type: "multi", options: ["a", "b", "c"], correct: [2, 0] },
      { type: "text", answers: ["Paris", "paris france"] },
      { type: "slider", min: 0, max: 100, correct: 40, tolerance: 10 },
      { type: "order", items: ["first", "second", "third"] },
      { type: "pairs", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
      { type: "poll", options: ["x", "y"] },
      { type: "choice", options: ["a", "b"], correct: 0, image: "https://example.com/a.png", explanation: " Why ", points: "double" },
    ];
    for (const extra of good) {
      assert.equal(validateQuizInput(quizOf(extra)).ok, true, JSON.stringify(extra));
    }
  });

  it("sorts multi answers, forces polls to no points, and keeps optional fields", () => {
    const multi = validateQuizInput(quizOf({ type: "multi", options: ["a", "b", "c"], correct: [2, 0] }));
    assert.deepEqual(multi.ok && multi.quiz.questions[0]?.type === "multi" && multi.quiz.questions[0].correct, [0, 2]);

    const poll = validateQuizInput(quizOf({ type: "poll", options: ["x", "y"], points: "double" }));
    assert.equal(poll.ok && poll.quiz.questions[0]?.points, "none");

    const extras = validateQuizInput(
      quizOf({ options: ["a", "b"], correct: 0, explanation: " Why ", image: "https://example.com/a.png" }),
    );
    assert.equal(extras.ok && extras.quiz.questions[0]?.explanation, "Why");
    assert.equal(extras.ok && extras.quiz.questions[0]?.image, "https://example.com/a.png");
  });

  it("rejects broken questions of every type", () => {
    const bad: Array<Record<string, unknown>> = [
      { type: "nope", options: ["a", "b"], correct: 0 },
      { type: "choice", options: ["a", "b"], correct: 2 },
      { type: "choice", options: ["a", "b"], correct: 0, points: "triple" },
      { type: "choice", options: ["a", "b"], correct: 0, image: "http://example.com/a.png" },
      { type: "choice", options: ["a", "b"], correct: 0, image: "javascript:alert(1)" },
      { type: "multi", options: ["a", "b"], correct: [] },
      { type: "multi", options: ["a", "b"], correct: [0, 0] },
      { type: "multi", options: ["a", "b"], correct: [2] },
      { type: "text", answers: [] },
      { type: "text", answers: [" "] },
      { type: "text", answers: ["a", "b", "c", "d", "e", "f"] },
      { type: "slider", min: 5, max: 5, correct: 5, tolerance: 0 },
      { type: "slider", min: 0, max: 10, correct: 11, tolerance: 0 },
      { type: "slider", min: 0, max: 10, correct: 5, tolerance: 11 },
      { type: "slider", min: 0, max: 10, correct: 5.5, tolerance: 1 },
      { type: "order", items: ["only"] },
      { type: "order", items: ["a", "b", "c", "d", "e", "f"] },
      { type: "pairs", pairs: [{ left: "a", right: "1" }] },
      { type: "pairs", pairs: [{ left: "a", right: "same" }, { left: "b", right: "Same" }] },
      { type: "poll", options: ["only"] },
    ];
    for (const extra of bad) {
      assert.equal(validateQuizInput(quizOf(extra)).ok, false, JSON.stringify(extra));
    }
  });
});
