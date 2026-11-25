import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QuizQuestion } from "../shared/events";
import { createGameManager, pointsFor } from "./game";

function question(correct = 1, time = 10): QuizQuestion {
  return { type: "choice", points: "standard", text: "Q", options: ["a", "b", "c", "d"], correct, time };
}

function setup(questions: QuizQuestion[] = [question(), question(2)]) {
  let clock = 1_000;
  const changes: string[] = [];
  const ends: string[] = [];
  const manager = createGameManager({
    now: () => clock,
    onChange: (pin) => changes.push(pin),
    onEnd: (pin) => ends.push(pin),
  });
  const started = manager.start(
    "1234",
    { title: "T", questions },
    [
      { socketId: "a", nickname: "Ann" },
      { socketId: "b", nickname: "Bob" },
    ],
  );
  return {
    manager,
    changes,
    ends,
    started,
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

describe("pointsFor", () => {
  it("scores 1000 for an instant answer and 500 at the buzzer", () => {
    assert.equal(pointsFor(0, 10, 1), 1000);
    assert.equal(pointsFor(10_000, 10, 1), 500);
    assert.equal(pointsFor(5_000, 10, 1), 750);
  });

  it("adds a streak bonus capped at five", () => {
    assert.equal(pointsFor(0, 10, 2), 1100);
    assert.equal(pointsFor(0, 10, 6), 1500);
    assert.equal(pointsFor(0, 10, 20), 1500);
  });

  it("clamps out-of-range elapsed time", () => {
    assert.equal(pointsFor(-50, 10, 1), 1000);
    assert.equal(pointsFor(99_000, 10, 1), 500);
  });
});

describe("game manager", () => {
  it("refuses to start twice, without players, or without questions", () => {
    const { manager } = setup();
    assert.equal(manager.start("1234", { title: "T", questions: [question()] }, [{ socketId: "x", nickname: "X" }]), false);
    assert.equal(manager.start("9999", { title: "T", questions: [question()] }, []), false);
    assert.equal(manager.start("9999", { title: "T", questions: [] }, [{ socketId: "x", nickname: "X" }]), false);
    assert.equal(manager.has("9999"), false);
    manager.disposeAll();
  });

  it("starts on the first question and hides the answer", () => {
    const { manager, started, changes } = setup();
    assert.equal(started, true);
    assert.deepEqual(changes, ["1234"]);
    const host = manager.stateFor("1234", "host");
    assert.equal(host?.phase, "question");
    assert.equal(host?.question?.reveal, null);
    assert.equal(host?.leftMs, 10_000);
    assert.equal(host?.me, null);
    assert.equal(host?.counts, null);
    manager.disposeAll();
  });

  it("ends the round early once everyone answered, then scores", () => {
    const { manager, tick } = setup();
    tick(1_000);
    manager.answer("1234", "a", 1);
    assert.equal(manager.stateFor("1234", "host")?.phase, "question");
    assert.equal(manager.stateFor("1234", "host")?.answered, 1);
    tick(1_000);
    manager.answer("1234", "b", 0);

    const host = manager.stateFor("1234", "host");
    assert.equal(host?.phase, "results");
    assert.deepEqual(host?.question?.reveal, { type: "choice", correct: 1 });
    assert.deepEqual(host?.counts, [1, 1, 0, 0]);
    assert.deepEqual(host?.board, [
      { nickname: "Ann", score: 950 },
      { nickname: "Bob", score: 0 },
    ]);

    const ann = manager.stateFor("1234", { socketId: "a" });
    assert.equal(ann?.me?.correct, true);
    assert.equal(ann?.me?.gained, 950);
    assert.equal(ann?.me?.rank, 1);
    const bob = manager.stateFor("1234", { socketId: "b" });
    assert.equal(bob?.me?.correct, false);
    assert.equal(bob?.me?.gained, 0);
    assert.equal(bob?.me?.rank, 2);
    manager.disposeAll();
  });

  it("ignores repeat, invalid, unknown, and late answers", () => {
    const { manager, tick } = setup();
    manager.answer("1234", "a", 1);
    manager.answer("1234", "a", 2);
    manager.answer("1234", "b", 4);
    manager.answer("1234", "b", -1);
    manager.answer("1234", "b", 1.5);
    manager.answer("1234", "b", "1");
    manager.answer("1234", "nobody", 1);
    manager.answer("0000", "b", 1);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.choice, 1);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.choice, null);
    tick(11_000);
    manager.answer("1234", "b", 1);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.choice, null);
    manager.disposeAll();
  });

  it("builds a streak across rounds and resets it on a miss", () => {
    const { manager } = setup([question(1), question(2), question(0)]);
    manager.answer("1234", "a", 1);
    manager.answer("1234", "b", 1);
    manager.next("1234");
    manager.answer("1234", "a", 2);
    manager.answer("1234", "b", 0);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.gained, 1100);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.gained, 0);
    manager.next("1234");
    manager.answer("1234", "a", 3);
    manager.answer("1234", "b", 0);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.gained, 0);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.gained, 1000);
    manager.disposeAll();
  });

  it("lets the host skip the timer, advance, finish, and return to the lobby", () => {
    const { manager, ends } = setup();
    manager.next("1234");
    assert.equal(manager.stateFor("1234", "host")?.phase, "results");
    manager.next("1234");
    const second = manager.stateFor("1234", "host");
    assert.equal(second?.phase, "question");
    assert.equal(second?.index, 1);
    manager.next("1234");
    manager.next("1234");
    const podium = manager.stateFor("1234", "host");
    assert.equal(podium?.phase, "podium");
    assert.equal(podium?.question, null);
    manager.next("1234");
    assert.equal(manager.has("1234"), false);
    assert.deepEqual(ends, ["1234"]);
    assert.equal(manager.stateFor("1234", "host"), null);
  });

  it("ends the round when the last unanswered player leaves", () => {
    const { manager } = setup();
    manager.answer("1234", "a", 1);
    manager.removePlayer("1234", "b");
    assert.equal(manager.stateFor("1234", "host")?.phase, "results");
    assert.equal(manager.stateFor("1234", "host")?.playerCount, 1);
    assert.equal(manager.stateFor("1234", { socketId: "b" }), null);
    manager.disposeAll();
  });

  it("ends the round on its own when time runs out", async () => {
    const changes: string[] = [];
    const manager = createGameManager({
      onChange: (pin) => changes.push(pin),
      onEnd: () => undefined,
    });
    manager.start("5555", { title: "T", questions: [question(1, 0.05)] }, [
      { socketId: "a", nickname: "Ann" },
    ]);
    assert.equal(manager.stateFor("5555", "host")?.phase, "question");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(manager.stateFor("5555", "host")?.phase, "results");
    assert.equal(manager.stateFor("5555", { socketId: "a" })?.me?.gained, 0);
    manager.disposeAll();
  });

  it("stops the timer when disposed", async () => {
    const changes: string[] = [];
    const manager = createGameManager({
      onChange: (pin) => changes.push(pin),
      onEnd: () => undefined,
    });
    manager.start("5555", { title: "T", questions: [question(1, 0.05)] }, [
      { socketId: "a", nickname: "Ann" },
    ]);
    manager.dispose("5555");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.deepEqual(changes, ["5555"]);
  });
});

describe("question types in a game", () => {
  it("doubles points, and gives none for no-points questions", () => {
    const { manager } = setup([
      { ...question(1), points: "double" },
      { ...question(1), points: "none" },
    ]);
    manager.answer("1234", "a", 1);
    manager.answer("1234", "b", 1);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.gained, 2000);
    manager.next("1234");
    manager.answer("1234", "a", 1);
    manager.answer("1234", "b", 1);
    const ann = manager.stateFor("1234", { socketId: "a" });
    assert.equal(ann?.me?.correct, true);
    assert.equal(ann?.me?.gained, 0);
    assert.equal(ann?.me?.score, 2000);
    manager.disposeAll();
  });

  it("polls give no points, reveal no answer, keep streaks, and count votes", () => {
    const { manager } = setup([
      question(1),
      { type: "poll", points: "none", text: "Vote", options: ["x", "y"], time: 10 },
      question(1),
    ]);
    manager.answer("1234", "a", 1);
    manager.answer("1234", "b", 1);
    manager.next("1234");
    manager.answer("1234", "a", 0);
    manager.answer("1234", "b", 0);
    const poll = manager.stateFor("1234", "host");
    assert.deepEqual(poll?.counts, [2, 0]);
    assert.equal(poll?.correctCount, null);
    assert.deepEqual(poll?.question?.reveal, { type: "poll" });
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.correct, null);
    manager.next("1234");
    manager.answer("1234", "a", 1);
    manager.answer("1234", "b", 1);
    // Streak survived the poll: this is the second correct answer in a row.
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.gained, 1100);
    manager.disposeAll();
  });

  it("grades multi, text, and slider questions with partial credit", () => {
    const { manager } = setup([
      { type: "multi", points: "standard", text: "M", options: ["a", "b", "c", "d"], correct: [0, 1], time: 10 },
      { type: "text", points: "standard", text: "T", answers: ["Paris"], time: 10 },
      { type: "slider", points: "standard", text: "S", min: 0, max: 100, correct: 50, tolerance: 10, time: 10 },
    ]);
    manager.answer("1234", "a", [0, 1]);
    manager.answer("1234", "b", [0]);
    const multi = manager.stateFor("1234", "host");
    assert.equal(multi?.correctCount, 1);
    assert.deepEqual(multi?.counts, [2, 1, 0, 0]);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.gained, 500);

    manager.next("1234");
    manager.answer("1234", "a", "paris");
    manager.answer("1234", "b", "london");
    assert.equal(manager.stateFor("1234", "host")?.correctCount, 1);
    assert.equal(manager.stateFor("1234", "host")?.counts, null);

    manager.next("1234");
    manager.answer("1234", "a", 50);
    manager.answer("1234", "b", 70);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.correct, false);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.correct, true);
    manager.disposeAll();
  });

  it("shows order and pair items shuffled and hides the answer until the end", () => {
    const { manager } = setup([
      { type: "order", points: "standard", text: "O", items: ["one", "two", "three"], time: 10 },
      {
        type: "pairs",
        points: "standard",
        text: "P",
        pairs: [
          { left: "a", right: "1" },
          { left: "b", right: "2" },
          { left: "c", right: "3" },
        ],
        time: 10,
      },
    ]);
    const order = manager.stateFor("1234", "host")?.question;
    assert.deepEqual([...(order?.items ?? [])].sort(), ["one", "three", "two"]);
    assert.notDeepEqual(order?.items, ["one", "two", "three"]);
    assert.equal(order?.reveal, null);

    // Answer with the shown items sorted back into the authored order.
    const shown = order?.items ?? [];
    const right = ["one", "two", "three"].map((item) => shown.indexOf(item));
    manager.answer("1234", "a", right);
    manager.answer("1234", "b", [0, 1, 2]);
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.correct, true);
    assert.equal(manager.stateFor("1234", { socketId: "b" })?.me?.correct, false);
    assert.deepEqual(manager.stateFor("1234", "host")?.question?.reveal, {
      type: "order",
      items: ["one", "two", "three"],
    });

    manager.next("1234");
    const pairs = manager.stateFor("1234", "host")?.question;
    assert.deepEqual(pairs?.items, ["a", "b", "c"]);
    const matches = pairs?.matches ?? [];
    manager.answer("1234", "a", ["1", "2", "3"].map((value) => matches.indexOf(value)));
    assert.equal(manager.stateFor("1234", { socketId: "a" })?.me?.answered, true);
    manager.disposeAll();
  });
});
