import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createQuizStore } from "./quizzes";

const input = {
  title: "Mine",
  questions: [{ text: "Q?", options: ["a", "b", "c", "d"], correct: 2, time: 20 }],
};

describe("quiz store", () => {
  it("seeds a demo quiz into an empty database", () => {
    const store = createQuizStore(":memory:");
    assert.equal(store.count(), 1);
    const [demo] = store.list();
    assert.equal(demo?.title, "Demo quiz");
    assert.equal(demo?.questionCount, 3);
  });

  it("round-trips a created quiz", () => {
    const store = createQuizStore(":memory:");
    const id = store.create(input);
    assert.deepEqual(store.get(id), { id, ...input });
    assert.equal(store.count(), 2);
    assert.equal(store.list().at(-1)?.id, id);
  });

  it("returns null for an unknown id", () => {
    const store = createQuizStore(":memory:");
    assert.equal(store.get("nope"), null);
  });
});
