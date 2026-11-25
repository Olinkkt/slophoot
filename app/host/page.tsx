"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { COLORS, SHAPES, TimerBar } from "../../lib/ui";
import { useLeft } from "../../lib/useLeft";
import { tok } from "../../lib/session";

export default function Host() {
  const s = useRef<Socket>();
  const [quizzes, setQuizzes] = useState<any[]>([]); const [st, setSt] = useState<any>(null); const [wait, setWait] = useState(false);
  useEffect(() => {
    fetch("/api/quizzes").then((r) => r.json()).then(setQuizzes);
    const k = io(); s.current = k;
    k.on("state", (x) => { setSt(x); setWait(false); });
    k.on("closed", () => { localStorage.removeItem("slophoot:hostpin"); setSt(null); setWait(false); });
    k.on("connect", () => { // po obnovení stránky nebo výpadku spojení se host vrátí do své místnosti
      const pin = localStorage.getItem("slophoot:hostpin"); if (!pin) return;
      setWait(true);
      k.emit("host:resume", { pin, token: tok("slophoot:host") }, (r: any) => { if (r.error) { localStorage.removeItem("slophoot:hostpin"); setSt(null); } setWait(false); });
    });
    return () => { k.disconnect(); };
  }, []);
  const left = useLeft(st?.left ?? 0, st?.i);
  const next = () => s.current!.emit("host:next");
  const close = () => s.current!.emit("host:close");
  const [err, setErr] = useState(""); const [copied, setCopied] = useState(false);
  const create = (id: string) => s.current!.emit("host:create", id, tok("slophoot:host"), (r: any) => {
    if (r.error) return setErr(r.error);
    localStorage.setItem("slophoot:hostpin", r.pin);
  });
  const Quit = () => <button className="btn-ghost fixed right-3 top-3 z-10 text-sm" onClick={() => confirm("Ukončit hru pro všechny?") && close()}>Ukončit hru</button>;
  const Btn = ({ t, off }: { t: string; off?: boolean }) => <button className="btn mt-6 px-10 text-xl" disabled={off} onClick={next}>{t}</button>;

  if (wait && !st) return <main className="grid min-h-screen place-items-center text-xl opacity-70">Obnovuji místnost…</main>;
  if (!st) return (
    <main className="mx-auto max-w-xl p-6 pt-16">
      <h1 className="text-4xl font-black">Vytvořit místnost</h1>
      <p className="mb-6 mt-2 opacity-80">Vyber kvíz. Vznikne místnost s PINem a QR kódem, přes který se žáci připojí.</p>
      {err && <p className="mb-3 rounded-lg bg-red-500/30 p-2">{err}</p>}
      {quizzes.length === 0 && <p className="card">Zatím tu není žádný kvíz. Vytvoř ho v editoru.</p>}
      <div className="space-y-3">{quizzes.map((q) => (
        <div key={q.id} className="card flex items-center justify-between gap-3">
          <div><div className="text-xl font-bold">{q.title}</div><div className="text-sm opacity-70">{q.questions.length} otázek</div></div>
          <button className="btn shrink-0 !px-5 !py-2" onClick={() => create(q.id)}>Vytvořit místnost</button>
        </div>))}</div>
      <a href="/editor" className="btn-ghost mt-6 inline-block">＋ Vytvořit nový kvíz</a>
    </main>);

  if (st.phase === "lobby") {
    const url = `${window.location.origin}/?pin=${st.pin}`;
    const local = /^(localhost|127\.)/.test(window.location.hostname);
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 p-6 md:flex-row">
        <div className="card text-center">
          <QRCodeSVG value={url} size={260} marginSize={3} fgColor="#1a0b47" className="mx-auto rounded-xl bg-white" />
          <p className="mt-3 break-all text-sm opacity-80">{url.replace(/^https?:\/\//, "")}</p>
          <button className="btn-ghost mt-3" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "Zkopírováno ✓" : "Zkopírovat odkaz"}</button>
        </div>
        <div className="flex-1 text-center">
          <p className="text-lg opacity-80">Naskenuj QR kód nebo zadej PIN</p>
          <h1 className="my-2 text-8xl font-black tracking-widest">{st.pin}</h1>
          {local && <p className="mx-auto my-3 max-w-md rounded-lg bg-yellow-400/20 p-2 text-sm">⚠ Běžíš na localhostu, telefony se přes QR nepřipojí. Otevři host stránku přes IP adresu počítače (např. http://192.168.x.x:3000/host).</p>}
          <p className="mt-4 text-sm opacity-70">Hráči: {st.players.length} (klepnutím na jméno hráče vyhodíš)</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">{st.players.map((p: any) => (
            <button key={p.id} title="Vyhodit hráče" className={`rounded-full bg-white px-4 py-1 font-semibold text-slate-900 hover:bg-red-200 ${p.online ? "" : "opacity-50"}`} onClick={() => s.current!.emit("host:kick", p.id)}>{p.name} ✕</button>))}</div>
          <Btn t="Spustit hru" off={st.players.length === 0} /><Quit />
        </div>
      </main>);
  }

  if (st.phase === "question") return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between text-xl font-semibold"><span>{st.i + 1}/{st.total}</span><span>{st.players.filter((p: any) => p.answered).length}/{st.players.length} odpovědělo</span><span className="text-3xl font-black">{left} s</span></div>
      <TimerBar ms={st.left} total={st.q.time} k={st.i} />
      <h1 className="card my-4 text-center text-4xl font-black md:text-5xl">{st.q.text}</h1>
      <div className="grid flex-1 grid-cols-2 gap-4">{st.q.options.map((o: string, k: number) => (
        <div key={k} className={`${COLORS[k]} flex items-center gap-4 rounded-2xl p-6 text-2xl font-bold shadow-[0_6px_0_rgba(0,0,0,.35)] md:text-3xl`}><span className="opacity-70">{SHAPES[k]}</span>{o}</div>))}</div>
      <div className="text-center"><Btn t="Ukončit kolo" /></div><Quit />
    </main>);

  if (st.phase === "results") {
    const max = Math.max(1, ...st.counts), top = Math.max(1, st.board[0]?.score ?? 1);
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="card text-center text-3xl font-black">{st.q.text}</h1>
        <div className="grid grid-cols-4 gap-3">{st.q.options.map((o: string, k: number) => (
          <div key={k} className={`flex flex-col justify-end ${k === st.q.correct ? "" : "opacity-40"}`}>
            <div className="mb-1 text-center text-3xl font-black">{st.counts[k]}</div>
            <div className={`${COLORS[k]} rounded-t-lg`} style={{ height: `${Math.max(6, (st.counts[k] / max) * 140)}px` }} />
            <div className={`${COLORS[k]} rounded-b-lg p-3 font-bold ${k === st.q.correct ? "ring-4 ring-white" : ""}`}>{SHAPES[k]} {o} {k === st.q.correct && "✓"}</div>
          </div>))}</div>
        <div className="card"><h2 className="mb-3 text-xl font-bold">Žebříček</h2>
          <ol className="space-y-2">{st.board.slice(0, 5).map((p: any, k: number) => (
            <li key={k} className="relative overflow-hidden rounded-lg bg-white/10 px-4 py-2 text-lg">
              <div className="absolute inset-y-0 left-0 bg-yellow-400/30" style={{ width: `${(p.score / top) * 100}%` }} />
              <div className="relative flex justify-between"><span>{k + 1}. {p.name}</span><b>{p.score}</b></div></li>))}</ol></div>
        <div className="text-center"><Btn t={st.i + 1 < st.total ? "Další otázka ▶" : "Pódium 🏆"} /></div><Quit />
      </main>);
  }

  const order = [1, 0, 2], h = ["h-40", "h-56", "h-28"], medal = ["🥈", "🥇", "🥉"];
  return (
    <main className="mx-auto max-w-3xl p-6 text-center">
      <h1 className="mb-10 mt-8 text-5xl font-black">Pódium</h1>
      <div className="flex items-end justify-center gap-3">{order.map((k, j) => st.board[k] && (
        <div key={k} className="w-1/3"><div className="text-4xl">{medal[j]}</div><p className="truncate text-xl font-bold">{st.board[k].name}</p>
          <div className={`${h[j]} mt-2 flex items-start justify-center rounded-t-xl bg-yellow-400 pt-3 text-2xl font-black text-slate-900`}>{st.board[k].score}</div></div>))}</div>
      <button className="btn-ghost mt-10" onClick={close}>Nová hra</button>
    </main>);
}
