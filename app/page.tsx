"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { COLORS, SHAPES, TimerBar } from "../lib/ui";
import { useLeft } from "../lib/useLeft";
import { tok } from "../lib/session";

const Center = ({ children, cls = "" }: { children: React.ReactNode; cls?: string }) => (
  <main className={`flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center ${cls}`}>{children}</main>
);

export default function Player() {
  const s = useRef<Socket>();
  const nameRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState(""); const [st, setSt] = useState<any>(null);
  const [joined, setJoined] = useState(false); const [boot, setBoot] = useState(false); const [fromQr, setFromQr] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pin")?.replace(/\D/g, "").slice(0, 4);
    if (p) { setPin(p); setFromQr(true); nameRef.current?.focus(); }
    const load = () => { try { return JSON.parse(localStorage.getItem("slophoot:me") || "null"); } catch { return null; } };
    if (p && load()?.pin !== p) localStorage.removeItem("slophoot:me"); // nový QR = jiná hra
    if (load()) setBoot(true);
    const k = io(); s.current = k;
    k.on("state", setSt);
    k.on("connect", () => { // po obnovení stránky nebo výpadku spojení se hráč vrátí do hry
      const me = load(); if (!me) return;
      k.emit("player:join", { ...me, token: tok("slophoot:player") }, (r: any) => {
        if (r.error) { localStorage.removeItem("slophoot:me"); setJoined(false); setSt(null); setErr(r.error); }
        else { setName(r.name); setPin(me.pin); setErr(""); setJoined(true); }
        setBoot(false);
      });
    });
    k.on("closed", (why?: string) => { localStorage.removeItem("slophoot:me"); setJoined(false); setSt(null); setErr(why === "kicked" ? "Hostitel tě odpojil" : "Hra skončila"); });
    return () => { k.disconnect(); };
  }, []);
  const left = useLeft(st?.left ?? 0, st?.i);
  const join = () => s.current!.emit("player:join", { pin, name, token: tok("slophoot:player") }, (r: any) => r.error ? setErr(r.error) : (localStorage.setItem("slophoot:me", JSON.stringify({ pin, name })), setErr(""), setJoined(true)));

  if (boot) return <Center><p className="opacity-70">Připojuji…</p></Center>;

  if (!joined) return (
    <Center>
      <h1 className="mb-4 text-5xl font-black tracking-tight">Slophoot!</h1>
      <form className="card flex w-full max-w-sm flex-col gap-3" onSubmit={(e) => { e.preventDefault(); join(); }}>
        {fromQr
          ? <p className="text-sm opacity-80">Připojuješ se do hry <b className="text-yellow-300">{pin}</b></p>
          : <input className="input text-center text-2xl font-bold tracking-widest" inputMode="numeric" maxLength={4} placeholder="PIN hry" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />}
        <input ref={nameRef} className="input text-center" maxLength={20} placeholder="Přezdívka" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={pin.length < 4 || !name.trim()}>Připojit se</button>
        {err && <p className="rounded-lg bg-red-500/30 p-2 text-sm">{err}</p>}
      </form>
      <a href="/host" className="mt-6 text-sm underline opacity-70">Jsem host</a>
    </Center>);

  if (!st || st.phase === "lobby") return <Center><div className="text-6xl">🙌</div><h1 className="text-3xl font-black">Jsi tam, {name}!</h1><p className="opacity-80">Vidíš svou přezdívku na velké obrazovce? Čekej na start.</p></Center>;

  if (st.phase === "question") return st.me.answered
    ? <Center><div className="animate-pulse text-6xl">⏳</div><h1 className="text-2xl font-bold">Odpověď odeslána</h1><p className="opacity-80">Čekáme na ostatní…</p></Center>
    : (
      <main className="flex h-[100dvh] flex-col gap-3 p-3">
        <div className="flex items-center justify-between px-1 text-sm font-semibold"><span>{st.i + 1}/{st.total}</span><span>{left} s</span></div>
        <TimerBar ms={st.left} total={st.q.time} k={st.i} />
        <div className="grid flex-1 grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((k) => (
            <button key={k} className={`${COLORS[k]} flex flex-col items-center justify-center gap-2 rounded-2xl p-2 text-xl font-extrabold shadow-[0_5px_0_rgba(0,0,0,.35)] active:translate-y-1 active:shadow-none`}
              onClick={() => s.current!.emit("player:answer", k)}>
              <span className="text-3xl opacity-70">{SHAPES[k]}</span><span className="break-words">{st.q.options[k]}</span>
            </button>))}
        </div>
      </main>);

  if (st.phase === "results") return (
    <Center cls={st.me.correct ? "bg-green-700/90" : "bg-red-700/90"}>
      <div className="text-7xl">{st.me.correct ? "✅" : "❌"}</div>
      <h1 className="text-4xl font-black">{st.me.correct ? "Správně!" : st.me.answered ? "Špatně" : "Čas vypršel"}</h1>
      <p className="text-3xl font-bold">+{st.me.gained} b</p>
      <p className="opacity-90">Celkem {st.me.score} b · {st.me.rank}. místo</p>
    </Center>);

  return <Center><div className="text-7xl">{["🥇", "🥈", "🥉"][st.me.rank - 1] ?? "🏁"}</div><h1 className="text-4xl font-black">Konec hry</h1><p className="text-2xl">{st.me.rank}. místo · {st.me.score} b</p><a href="/" className="btn-ghost mt-4">Hrát znovu</a></Center>;
}
