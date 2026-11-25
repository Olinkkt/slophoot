import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QuizQuestion } from "../shared/events";
import { acceptAnswer, grade, matchesText, shuffled } from "./grading";

const base = { text: "Q", time: 10, points: "standard" } as const;

describe("matchesText", () => {
  it("ignores case, accents, and punctuation", () => {
    assert.equal(matchesText("  PARIS!! ", ["paris"]), true);
    assert.equal(matchesText("Sao Paulo", ["São Paulo"]), true);
  });

  it("forgives typos only in longer answers", () => {
    assert.equal(matchesText("Pariss", ["Paris"]), true);
    assert.equal(matchesText("Rom", ["Rome"]), false);
    assert.equal(matchesText("Mississipi", ["Mississippi"]), true);
    assert.equal(matchesText("Londn", ["London"]), true);
    assert.equal(matchesText("Berlin", ["Paris"]), false);
    assert.equal(matchesText("", ["Paris"]), false);
  });
});

describe("shuffled", () => {
  it("is a permutation and is never the identity", () => {
    for (let n = 2; n <= 5; n += 1) {
      for (let run = 0; run < 50; run += 1) {
        const order = shuffled(n);
        assert.deepEqual([...order].sort(), Array.from({ length: n }, (_, i) => i));
        assert.equal(
          order.every((value, index) => value === index),
          false,
        );
      }
    }
  });
});

describe("acceptAnswer", () => {
  const choice: QuizQuestion = { ...base, type: "choice", options: ["a", "b"], correct: 0 };
  const multi: QuizQuestion = { ...base, type: "multi", options: ["a", "b", "c"], correct: [0, 1] };
  const slider: QuizQuestion = { ...base, type: "slider", min: 0, max: 10, correct: 5, tolerance: 2 };
  const order: QuizQuestion = { ...base, type: "order", items: ["a", "b", "c"] };
  const text: QuizQuestion = { ...base, type: "text", answers: ["x"] };

  it("checks the shape for each type", () => {
    assert.equal(acceptAnswer(choice, 1), 1);
    assert.equal(acceptAnswer(choice, 2), null);
    assert.equal(acceptAnswer(choice, "1"), null);
    assert.deepEqual(acceptAnswer(multi, [2, 0]), [0, 2]);
    assert.equal(acceptAnswer(multi, []), null);
    assert.equal(acceptAnswer(multi, [0, 0]), null);
    assert.equal(acceptAnswer(slider, 7.5), 7.5);
    assert.equal(acceptAnswer(slider, 11), null);
    assert.equal(acceptAnswer(slider, Number.NaN), null);
    assert.deepEqual(acceptAnswer(order, [2, 0, 1]), [2, 0, 1]);
    assert.equal(acceptAnswer(order, [0, 0, 1]), null);
    assert.equal(acceptAnswer(order, [0, 1]), null);
    assert.equal(acceptAnswer(text, "  hello   there "), "hello there");
    assert.equal(acceptAnswer(text, "   "), null);
    assert.equal(acceptAnswer(text, "x".repeat(101)), null);
  });
});

describe("grade", () => {
  it("gives partial credit for multi answers and punishes wrong ticks", () => {
    const multi: QuizQuestion = { ...base, type: "multi", options: ["a", "b", "c", "d"], correct: [0, 1] };
    assert.deepEqual(grade(multi, [0, 1], []), { correct: true, credit: 1 });
    assert.deepEqual(grade(multi, [0], []), { correct: false, credit: 0.5 });
    assert.deepEqual(grade(multi, [0, 2], []), { correct: false, credit: 0 });
    assert.deepEqual(grade(multi, [0, 1, 2], []), { correct: false, credit: 0.5 });
  });

  it("scores sliders by distance", () => {
    const slider: QuizQuestion = { ...base, type: "slider", min: 0, max: 100, correct: 50, tolerance: 10 };
    assert.deepEqual(grade(slider, 50, []), { correct: true, credit: 1 });
    assert.deepEqual(grade(slider, 60, []), { correct: true, credit: 0.5 });
    assert.deepEqual(grade(slider, 40, []), { correct: true, credit: 0.5 });
    assert.deepEqual(grade(slider, 61, []), { correct: false, credit: 0 });

    const exact: QuizQuestion = { ...slider, tolerance: 0 };
    assert.deepEqual(grade(exact, 50, []), { correct: true, credit: 1 });
    assert.deepEqual(grade(exact, 51, []), { correct: false, credit: 0 });
  });

  it("maps order answers back through the shuffle", () => {
    const order: QuizQuestion = { ...base, type: "order", items: ["first", "second", "third"] };
    // Slot 0 shows "third", slot 1 "first", slot 2 "second".
    const shuffle = [2, 0, 1];
    assert.deepEqual(grade(order, [1, 2, 0], shuffle), { correct: true, credit: 1 });
    assert.deepEqual(grade(order, [0, 1, 2], shuffle), { correct: false, credit: 0 });
    const oneRight = grade(order, [1, 0, 2], shuffle);
    assert.equal(oneRight.correct, false);
    assert.ok(Math.abs(oneRight.credit - 1 / 3) < 1e-9);
  });

  it("maps pair answers back through the shuffle", () => {
    const pairs: QuizQuestion = {
      ...base,
      type: "pairs",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
        { left: "c", right: "3" },
      ],
    };
    // Right-hand slots show "3", "1", "2".
    const shuffle = [2, 0, 1];
    assert.deepEqual(grade(pairs, [1, 2, 0], shuffle), { correct: true, credit: 1 });
    assert.deepEqual(grade(pairs, [0, 1, 2], shuffle), { correct: false, credit: 0 });
  });

  it("has no right answer for polls", () => {
    const poll: QuizQuestion = { ...base, type: "poll", options: ["a", "b"] };
    assert.deepEqual(grade(poll, 0, []), { correct: null, credit: 0 });
  });
});
