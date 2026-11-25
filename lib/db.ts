import { mkdirSync } from "fs";
import { dirname } from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { quizzes } from "./schema";
const dbPath = process.env.DB_PATH || "data/slophoot.db";
mkdirSync(dirname(dbPath), { recursive: true }); // složka data/ nemusí existovat
const sqlite = new Database(dbPath);
sqlite.exec("CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions TEXT NOT NULL)");
export const db = drizzle(sqlite);
if (db.select().from(quizzes).all().length === 0) {
  db.insert(quizzes).values({ id: "demo", title: "Ukázkový kvíz", questions: [
    { text: "Hlavní město Česka?", options: ["Brno", "Praha", "Ostrava", "Plzeň"], correct: 1, time: 15 },
    { text: "Kolik je 7 × 8?", options: ["54", "56", "58", "64"], correct: 1, time: 15 },
  ] }).run();
}
