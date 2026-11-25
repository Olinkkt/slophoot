import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export type Question = { text: string; options: string[]; correct: number; time: number };
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  questions: text("questions", { mode: "json" }).$type<Question[]>().notNull(),
});
