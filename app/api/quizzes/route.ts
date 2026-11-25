import { db } from "../../../lib/db";
import { quizzes } from "../../../lib/schema";
import { randomUUID } from "crypto";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json(db.select().from(quizzes).all()); }
export async function POST(req: Request) {
  const b = await req.json();
  const ok = typeof b.title === "string" && b.title.trim() && Array.isArray(b.questions) && b.questions.length > 0 &&
    b.questions.every((q: any) => q.text?.trim() && q.options?.length === 4 && q.options.every((o: string) => o.trim()) && q.correct >= 0 && q.correct < 4 && q.time >= 5 && q.time <= 120);
  if (!ok) return Response.json({ error: "Neplatný kvíz" }, { status: 400 });
  const id = randomUUID();
  db.insert(quizzes).values({ id, title: b.title.trim(), questions: b.questions }).run();
  return Response.json({ id });
}
