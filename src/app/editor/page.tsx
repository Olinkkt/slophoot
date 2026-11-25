"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GoldButton, Logo, Stage } from "@/components/stage";
import { QUIZ_QUESTIONS_MAX, QUIZ_TITLE_MAX, validateQuizInput } from "@/shared/quiz";
import { blankDraft, toQuestionInput, type Draft } from "./draft";
import { QuestionCard } from "./question-card";

type Notice = { ok: boolean; text: string };

const INPUT =
  "h-11 w-full rounded border-2 border-line bg-white px-3 text-base text-sh-ink placeholder:text-[#767676]";

export default function EditorPage() {
  const nextKey = useRef(1);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Draft[]>(() => [blankDraft(0)]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const update = (key: number, change: (question: Draft) => Draft) => {
    setQuestions((current) => current.map((q) => (q.key === key ? change(q) : q)));
  };

  const save = async () => {
    if (saving) {
      return;
    }

    const inputs = questions.map(toQuestionInput);
    for (const [position, input] of inputs.entries()) {
      const check = validateQuizInput({ title: "x", questions: [input] });
      if (!check.ok) {
        setNotice({ ok: false, text: `Question ${position + 1}: ${check.message}` });
        return;
      }
    }

    const result = validateQuizInput({ title, questions: inputs });
    if (!result.ok) {
      setNotice({ ok: false, text: result.message });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.quiz),
      });
      if (response.ok) {
        setNotice({ ok: true, text: "Quiz saved. Pick it in the host lobby." });
        setTitle("");
        setQuestions([blankDraft(nextKey.current++)]);
      } else {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setNotice({ ok: false, text: body?.error ?? "Couldn’t save the quiz." });
      }
    } catch {
      setNotice({ ok: false, text: "Couldn’t reach the server. Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stage variant="join">
      <main className="relative z-1 mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <Logo className="mx-auto w-56" priority />
        <h1 className="text-center text-3xl font-black">Quiz editor</h1>

        <label htmlFor="quiz-title" className="sr-only">
          Quiz title
        </label>
        <input
          id="quiz-title"
          className={INPUT}
          placeholder="Quiz title"
          maxLength={QUIZ_TITLE_MAX}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />

        {questions.map((question, index) => (
          <QuestionCard
            key={question.key}
            draft={question}
            index={index}
            canRemove={questions.length > 1}
            onChange={(change) => {
              update(question.key, change);
            }}
            onRemove={() => {
              setQuestions((current) => current.filter((q) => q.key !== question.key));
            }}
          />
        ))}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <GoldButton
            type="button"
            className="sh-gold-join max-w-56"
            disabled={questions.length >= QUIZ_QUESTIONS_MAX}
            onClick={() => {
              setQuestions((current) => [...current, blankDraft(nextKey.current++)]);
            }}
          >
            Add question
          </GoldButton>
          <GoldButton
            type="button"
            className="sh-gold-join max-w-56"
            disabled={saving}
            onClick={() => {
              void save();
            }}
          >
            {saving ? "Saving…" : "Save quiz"}
          </GoldButton>
        </div>

        {notice ? (
          <p role={notice.ok ? "status" : "alert"} className="sh-notice self-center">
            {notice.text}
          </p>
        ) : null}
        <Link href="/host" className="text-center underline underline-offset-4">
          Back to hosting
        </Link>
      </main>
    </Stage>
  );
}
