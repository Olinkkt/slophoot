import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { eq } from "drizzle-orm";
import { db } from "./lib/db";
import { quizzes, Question } from "./lib/schema";

type P = { id: string; sock: string | null; name: string; score: number; streak: number; choice: number | null; at: number; gained: number };
type Room = { pin: string; host: string; hostSock: string | null; title: string; qs: Question[]; phase: "lobby" | "question" | "results" | "podium"; i: number; start: number; players: Map<string, P>; timer?: NodeJS.Timeout; gc?: NodeJS.Timeout };
const GRACE_MS = 10 * 60 * 1000; // jak dlouho místnost čeká na návrat hosta

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const srv = createServer((req, res) => handle(req, res));
  const io = new Server(srv);
  const rooms = new Map<string, Room>();
  const allIn = (r: Room) => { const c = [...r.players.values()].filter((p) => p.sock); return c.length > 0 && c.every((p) => p.choice !== null); };
  const board = (r: Room) => [...r.players.values()].sort((a, b) => b.score - a.score);

  const push = (r: Room) => {
    const q = r.qs[r.i], b = board(r), show = r.phase === "results";
    const inQ = r.phase === "question" || show;
    const base = {
      phase: r.phase, pin: r.pin, title: r.title, i: r.i, total: r.qs.length,
      left: r.phase === "question" ? Math.max(0, r.start + q.time * 1000 - Date.now()) : 0,
      q: inQ ? { text: q.text, options: q.options, time: q.time, correct: show ? q.correct : null } : null,
      board: b.slice(0, 10).map((p) => ({ name: p.name, score: p.score })),
    };
    if (r.hostSock) io.to(r.hostSock).emit("state", { ...base, players: b.map((p) => ({ id: p.id, name: p.name, answered: p.choice !== null, online: !!p.sock })),
      counts: show ? q.options.map((_, k) => b.filter((p) => p.choice === k).length) : null });
    r.players.forEach((p) => p.sock && io.to(p.sock).emit("state", { ...base,
      me: { name: p.name, score: p.score, rank: b.indexOf(p) + 1, answered: p.choice !== null, correct: show ? p.choice === q.correct : null, gained: p.gained } }));
  };

  const closeRoom = (r: Room) => {
    clearTimeout(r.timer); clearTimeout(r.gc);
    r.players.forEach((p) => p.sock && io.to(p.sock).emit("closed"));
    if (r.hostSock) io.to(r.hostSock).emit("closed");
    rooms.delete(r.pin);
  };

  const endRound = (r: Room) => {
    if (r.phase !== "question") return;
    clearTimeout(r.timer);
    const q = r.qs[r.i];
    r.players.forEach((p) => {
      if (p.choice === q.correct) {
        p.streak++;
        p.gained = Math.round(1000 * (1 - 0.5 * (p.at - r.start) / (q.time * 1000))) + Math.min(p.streak - 1, 5) * 100;
      } else { p.streak = 0; p.gained = 0; }
      p.score += p.gained;
    });
    r.phase = "results"; push(r);
  };

  const ask = (r: Room) => {
    r.phase = "question"; r.start = Date.now();
    r.players.forEach((p) => { p.choice = null; p.gained = 0; });
    r.timer = setTimeout(() => endRound(r), r.qs[r.i].time * 1000);
    push(r);
  };

  io.on("connection", (s) => {
    const hostRoom = () => { const r = rooms.get(s.data.pin); return r && s.data.role === "host" && r.hostSock === s.id ? r : undefined; };
    const bind = (r: Room, role: string, token: string) => { s.data.pin = r.pin; s.data.role = role; s.data.token = token; };
    const clean = (t: unknown) => String(t || "").slice(0, 64);

    s.on("host:create", (quizId: string, token: string, ack) => {
      token = clean(token);
      const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
      if (!quiz) return ack({ error: "Kvíz neexistuje" });
      if (!token) return ack({ error: "Chybí identifikátor" });
      let pin: string;
      do { pin = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(pin));
      const r: Room = { pin, host: token, hostSock: s.id, title: quiz.title, qs: quiz.questions, phase: "lobby", i: 0, start: 0, players: new Map() };
      rooms.set(pin, r); bind(r, "host", token); push(r); ack({ pin });
    });
    s.on("host:resume", ({ pin, token }: { pin: string; token: string }, ack) => {
      const r = rooms.get(String(pin));
      if (!r || r.host !== clean(token)) return ack({ error: "Místnost už neexistuje" });
      clearTimeout(r.gc); r.hostSock = s.id; bind(r, "host", r.host); push(r); ack({ pin: r.pin });
    });
    s.on("player:join", ({ pin, name, token }: { pin: string; name: string; token: string }, ack) => {
      const r = rooms.get(String(pin)); token = clean(token); name = String(name || "").trim().slice(0, 20);
      if (!r) return ack({ error: "Místnost nenalezena" });
      if (!token) return ack({ error: "Chybí identifikátor" });
      const ex = r.players.get(token);
      if (ex) { ex.sock = s.id; bind(r, "player", token); push(r); return ack({ ok: true, name: ex.name }); } // návrat do hry
      if (!name) return ack({ error: "Zadej přezdívku" });
      if (r.phase !== "lobby") return ack({ error: "Hra už běží" });
      if ([...r.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) return ack({ error: "Přezdívka je obsazená" });
      r.players.set(token, { id: token, sock: s.id, name, score: 0, streak: 0, choice: null, at: 0, gained: 0 });
      bind(r, "player", token); push(r); ack({ ok: true, name });
    });
    s.on("player:answer", (choice: number) => {
      const r = rooms.get(s.data.pin), p = r?.players.get(s.data.token);
      if (!r || !p || r.phase !== "question" || p.choice !== null || !(choice >= 0 && choice < 4)) return;
      p.choice = choice; p.at = Date.now();
      if (allIn(r)) endRound(r); else push(r);
    });
    s.on("host:kick", (id: string) => {
      const r = hostRoom(), p = r?.players.get(id);
      if (!r || !p) return;
      r.players.delete(id); if (p.sock) io.to(p.sock).emit("closed", "kicked");
      if (r.phase === "question" && allIn(r)) endRound(r); else push(r);
    });
    s.on("host:next", () => {
      const r = hostRoom();
      if (!r) return;
      if (r.phase === "lobby" && r.players.size > 0) { r.i = 0; ask(r); }
      else if (r.phase === "question") endRound(r);
      else if (r.phase === "results") { if (r.i + 1 < r.qs.length) { r.i++; ask(r); } else { r.phase = "podium"; push(r); } }
    });
    s.on("host:close", () => { const r = hostRoom(); if (r) closeRoom(r); });
    s.on("disconnect", () => {
      const r = rooms.get(s.data.pin);
      if (!r) return;
      if (s.data.role === "host") {
        if (r.hostSock === s.id) { r.hostSock = null; r.gc = setTimeout(() => closeRoom(r), GRACE_MS); }
        return;
      }
      const p = r.players.get(s.data.token);
      if (p && p.sock === s.id) { p.sock = null; if (r.phase === "question" && allIn(r)) endRound(r); else push(r); }
    });
  });

  const port = Number(process.env.PORT) || 3000;
  srv.listen(port, () => console.log(`Slophoot na :${port}`));
});
