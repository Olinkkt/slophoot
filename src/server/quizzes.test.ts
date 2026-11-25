import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QuizInput } from "../shared/events";
import { createQuizStore } from "./quizzes";

const input: QuizInput = {
  title: "Mine",
  questions: [{ type: "choice", points: "standard", text: "Q?", options: ["a", "b", "c", "d"], correct: 2, time: 20 }],
};

describe("quiz store", () => {
  it("seeds a demo quiz into an empty database", () => {
    const store = createQuizStore(":memory:");
    assert.equal(store.count(), 2);
    const [demo, allTypes] = store.list();
    assert.equal(demo?.title, "Demo quiz");
    assert.equal(demo?.questionCount, 3);
    assert.equal(allTypes?.title, "Demo quiz #2");
    assert.equal(allTypes?.questionCount, 8);
  });

  it("demo quiz #2 covers every question type", () => {
    const store = createQuizStore(":memory:");
    const id = store.list().find((quiz) => quiz.title === "Demo quiz #2")?.id ?? "";
    const types = new Set(store.get(id)?.questions.map((question) => question.type));
    assert.deepEqual([...types].sort(), ["choice", "multi", "order", "pairs", "poll", "slider", "text"]);
  });

  it("round-trips a created quiz", () => {
    const store = createQuizStore(":memory:");
    const id = store.create(input);
    assert.deepEqual(store.get(id), { id, ...input });
    assert.equal(store.count(), 3);
    assert.equal(store.list().at(-1)?.id, id);
  });

  it("returns null for an unknown id", () => {
    const store = createQuizStore(":memory:");
    assert.equal(store.get("nope"), null);
  });

  it("reads quizzes saved before question types existed", () => {
    const store = createQuizStore(":memory:");
    const legacy = [{ text: "Old?", options: ["a", "b", "c", "d"], correct: 3, time: 20 }];
    // Writes the old shape straight into the table.
    const id = store.create({ title: "Old", questions: legacy as unknown as QuizInput["questions"] });
    assert.deepEqual(store.get(id)?.questions, [
      { type: "choice", points: "standard", text: "Old?", options: ["a", "b", "c", "d"], correct: 3, time: 20 },
    ]);
  });
});
