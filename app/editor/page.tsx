"use client";
import { useState } from "react";
import { COLORS, SHAPES } from "../../lib/ui";
const blank = () => ({ text: "", options: ["", "", "", ""], correct: 0, time: 20 });
export default function Editor() {
  const [title, setTitle] = useState(""); const [qs, setQs] = useState([blank()]); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const upd = (i: number, f: (q: any) => void) => setQs(qs.map((q, j) => { if (j !== i) return q; const c = { ...q, options: [...q.options] }; f(c); return c; }));
  const save = async () => {
    const r = await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, questions: qs }) });
    setMsg(r.ok ? { ok: true, t: "Kvíz uložen ✓" } : { ok: false, t: "Vyplň název, otázky a všechny 4 odpovědi (čas 5–120 s)" });
  };
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 pb-32">
      <h1 className="text-3xl font-black">Editor kvízů</h1>
      <input className="input" placeholder="Název kvízu" value={title} onChange={(e) => setTitle(e.target.value)} />
      {qs.map((q, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex items-center justify-between"><b>Otázka {i + 1}</b>
            {qs.length > 1 && <button className="text-sm underline opacity-70" onClick={() => setQs(qs.filter((_, j) => j !== i))}>Smazat</button>}</div>
          <input className="input" placeholder="Znění otázky" value={q.text} onChange={(e) => upd(i, (c) => (c.text = e.target.value))} />
          {q.options.map((o: string, k: number) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" className="h-5 w-5 accent-yellow-400" checked={q.correct === k} onChange={() => upd(i, (c) => (c.correct = k))} title="Správná odpověď" />
              <span className={`${COLORS[k]} grid h-10 w-10 place-items-center rounded-lg`}>{SHAPES[k]}</span>
              <input className="input flex-1 py-2" placeholder={`Odpověď ${k + 1}`} value={o} onChange={(e) => upd(i, (c) => (c.options[k] = e.target.value))} /></label>))}
          <label className="flex items-center gap-2 text-sm">Čas (s) <input type="number" min={5} max={120} className="input w-24 py-1" value={q.time} onChange={(e) => upd(i, (c) => (c.time = +e.target.value))} /></label>
        </div>))}
      <div className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-[#150a38]/90 p-3 backdrop-blur">
        <button className="btn-ghost" onClick={() => setQs([...qs, blank()])}>＋ Přidat otázku</button>
        <button className="btn" onClick={save}>Uložit kvíz</button>
        <a href="/host" className="btn-ghost">Na hostování</a>
        {msg && <span className={msg.ok ? "text-green-300" : "text-red-300"}>{msg.t}</span>}
      </div>
    </main>);
}
