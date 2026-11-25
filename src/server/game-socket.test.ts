import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, describe, it } from "node:test";
import { Server } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameErrorPayload,
  GameState,
  HostReadyPayload,
  JoinErrorPayload,
  LobbyUpdate,
  QuizQuestion,
  ServerToClientEvents,
} from "../shared/events";
import { GAME_ERRORS, JOIN_ERRORS } from "../shared/validation";
import { createCreateLimiter } from "./rate-limit";
import { createRoomStore } from "./rooms";
import { attachGameServer } from "./socket";

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

const QUESTIONS: QuizQuestion[] = [
  { type: "choice", points: "standard", text: "One", options: ["a", "b", "c", "d"], correct: 1, time: 30 },
  { type: "choice", points: "standard", text: "Two", options: ["a", "b", "c", "d"], correct: 2, time: 30 },
];

function waitFor<T>(socket: TestClient, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 2000);
    socket.once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args[0] as T);
    });
  });
}

function watchStates(socket: TestClient) {
  const queue: GameState[] = [];
  const waiters: Array<() => void> = [];
  socket.on("game:state", (state) => {
    queue.push(state);
    for (const wake of waiters.splice(0)) {
      wake();
    }
  });

  return {
    async until(predicate: (state: GameState) => boolean, ms = 2000): Promise<GameState> {
      const deadline = Date.now() + ms;
      for (;;) {
        while (queue.length > 0) {
          const state = queue.shift();
          if (state && predicate(state)) {
            return state;
          }
        }

        const left = deadline - Date.now();
        if (left <= 0) {
          throw new Error("timed out waiting for a matching game:state");
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, left);
          waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    },
  };
}

function connect(port: number): Promise<TestClient> {
  const socket: TestClient = ioClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("timed out connecting"));
    }, 2000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

async function withServer(run: (port: number) => Promise<void>): Promise<void> {
  const httpServer = createServer();
  const io: GameServer = new Server(httpServer);
  attachGameServer(io, createRoomStore({ randomPin: () => 4321 }), createCreateLimiter({ cooldownMs: 0 }), {
    findQuiz: (id) => (id === "demo" ? { title: "Demo", questions: QUESTIONS } : null),
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("expected a TCP port");
  }

  try {
    await run(address.port);
  } finally {
    io.disconnectSockets(true);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
}

describe("game over sockets", () => {
  const clients: TestClient[] = [];

  after(() => {
    for (const client of clients) {
      client.close();
    }
  });

  async function lobby(port: number, nicknames: string[]) {
    const host = await connect(port);
    clients.push(host);
    const ready = waitFor<HostReadyPayload>(host, "host:ready");
    host.emit("host:create");
    const { pin } = await ready;
    const players: TestClient[] = [];
    for (const nickname of nicknames) {
      const player = await connect(port);
      clients.push(player);
      const joined = waitFor<LobbyUpdate>(player, "lobby:update");
      player.emit("player:join", { pin, nickname });
      await joined;
      players.push(player);
    }
    return { host, players, pin };
  }

  it("plays a full game and returns to the lobby", { timeout: 8000 }, async () => {
    await withServer(async (port) => {
      const { host, players, pin } = await lobby(port, ["Ann", "Bob"]);
      const [ann, bob] = players as [TestClient, TestClient];
      const hostStates = watchStates(host);
      const annStates = watchStates(ann);

      host.emit("host:start", { pin, quizId: "demo" });
      const h1 = await hostStates.until((s) => s.phase === "question");
      const a1 = await annStates.until((s) => s.phase === "question");
      assert.equal(h1.question?.reveal, null);
      assert.equal(h1.me, null);
      assert.equal(a1.me?.nickname, "Ann");

      ann.emit("player:answer", { pin, choice: 1 });
      bob.emit("player:answer", { pin, choice: 0 });
      const h2 = await hostStates.until((s) => s.phase === "results");
      const a2 = await annStates.until((s) => s.phase === "results");
      assert.deepEqual(h2.question?.reveal, { type: "choice", correct: 1 });
      assert.deepEqual(h2.counts, [1, 1, 0, 0]);
      assert.equal(a2.me?.correct, true);
      assert.equal(a2.me?.rank, 1);
      assert.ok((a2.me?.gained ?? 0) >= 500);

      host.emit("host:next", { pin });
      assert.equal((await hostStates.until((s) => s.phase === "question")).index, 1);
      host.emit("host:next", { pin });
      await hostStates.until((s) => s.phase === "results");
      host.emit("host:next", { pin });
      await hostStates.until((s) => s.phase === "podium");

      const ended = waitFor<undefined>(ann, "game:ended");
      const back = waitFor<LobbyUpdate>(ann, "lobby:update");
      host.emit("host:next", { pin });
      await ended;
      assert.equal((await back).players.length, 2);
    });
  });

  it("only lets the host start, and needs players and a real quiz", { timeout: 5000 }, async () => {
    await withServer(async (port) => {
      const empty = await connect(port);
      clients.push(empty);
      const ready = waitFor<HostReadyPayload>(empty, "host:ready");
      empty.emit("host:create");
      const { pin } = await ready;
      const noPlayers = waitFor<GameErrorPayload>(empty, "game:error");
      empty.emit("host:start", { pin, quizId: "demo" });
      assert.equal((await noPlayers).message, GAME_ERRORS.noPlayers);
      empty.close();

      const { host, players, pin: pin2 } = await lobby(port, ["Ann"]);
      const [ann] = players as [TestClient];
      const notHost = waitFor<GameErrorPayload>(ann, "game:error");
      ann.emit("host:start", { pin: pin2, quizId: "demo" });
      assert.equal((await notHost).message, GAME_ERRORS.notHost);

      const noQuiz = waitFor<GameErrorPayload>(host, "game:error");
      host.emit("host:start", { pin: pin2, quizId: "missing" });
      assert.equal((await noQuiz).message, GAME_ERRORS.noQuiz);

      const bad = waitFor<GameErrorPayload>(host, "game:error");
      host.emit("host:start", { pin: pin2 } as never);
      assert.equal((await bad).message, GAME_ERRORS.invalid);
    });
  });

  it("rejects late joiners and ignores answers from outsiders", { timeout: 5000 }, async () => {
    await withServer(async (port) => {
      const { host, players, pin } = await lobby(port, ["Ann"]);
      const hostStates = watchStates(host);
      host.emit("host:start", { pin, quizId: "demo" });
      await hostStates.until((s) => s.phase === "question");

      const late = await connect(port);
      clients.push(late);
      const rejected = waitFor<JoinErrorPayload>(late, "join:error");
      late.emit("player:join", { pin, nickname: "Late" });
      assert.equal((await rejected).message, JOIN_ERRORS.gameStarted);

      // An outsider answering must not count or end the round.
      late.emit("player:answer", { pin, choice: 1 });
      const [ann] = players as [TestClient];
      ann.emit("player:answer", { pin, choice: 1 });
      const results = await hostStates.until((s) => s.phase === "results");
      assert.equal(results.answered, 1);
      assert.equal(results.playerCount, 1);
    });
  });

  it("ends the round when the last unanswered player disconnects", { timeout: 5000 }, async () => {
    await withServer(async (port) => {
      const { host, players, pin } = await lobby(port, ["Ann", "Bob"]);
      const [ann, bob] = players as [TestClient, TestClient];
      const hostStates = watchStates(host);
      host.emit("host:start", { pin, quizId: "demo" });
      await hostStates.until((s) => s.phase === "question");

      ann.emit("player:answer", { pin, choice: 1 });
      await hostStates.until((s) => s.answered === 1);
      bob.close();
      const state = await hostStates.until((s) => s.phase === "results");
      assert.equal(state.playerCount, 1);
    });
  });

  it("drops the game when the host's room closes", { timeout: 5000 }, async () => {
    await withServer(async (port) => {
      const { host, players, pin } = await lobby(port, ["Ann"]);
      const [ann] = players as [TestClient];
      const hostStates = watchStates(host);
      host.emit("host:start", { pin, quizId: "demo" });
      await hostStates.until((s) => s.phase === "question");

      const closed = waitFor<undefined>(ann, "room:closed");
      // A second create from the same socket closes the first room.
      host.emit("host:create");
      await closed;

      const late = await connect(port);
      clients.push(late);
      const error = waitFor<JoinErrorPayload>(late, "join:error");
      late.emit("player:join", { pin, nickname: "Late" });
      assert.equal((await error).message, JOIN_ERRORS.unknownPin);
    });
  });
});
