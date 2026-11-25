"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GoldButton, Logo, Stage } from "@/components/stage";
import {
  OPTION_COUNT,
  OPTION_TEXT_MAX,
  QUESTION_TEXT_MAX,
  QUESTION_TIME_DEFAULT,
  QUESTION_TIME_MAX,
  QUESTION_TIME_MIN,
  QUIZ_QUESTIONS_MAX,
  QUIZ_TITLE_MAX,
  validateQuizInput,
} from "@/shared/quiz";

type DraftQuestion = {
  key: number;
  text: string;
  options: string[];
  correct: number;
  time: string;
};

type Notice = { ok: boolean; text: string };

const SHAPES = ["▲", "◆", "●", "■"];
const SWATCHES = ["bg-[#c8102e]", "bg-[#1368ce]", "bg-[#a87400]", "bg-[#26890c]"];
const INPUT =
  "h-11 w-full rounded border-2 border-line bg-white px-3 text-base text-sh-ink placeholder:text-[#767676]";

function blank(key: number): DraftQuestion {
  return {
    key,
    text: "",
    options: Array.from({ length: OPTION_COUNT }, () => ""),
    correct: 0,
    time: String(QUESTION_TIME_DEFAULT),
  };
}

export default function EditorPage() {
  const nextKey = useRef(1);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [blank(0)]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const update = (key: number, change: (question: DraftQuestion) => DraftQuestion) => {
    setQuestions((current) => current.map((q) => (q.key === key ? change(q) : q)));
  };

  const save = async () => {
    if (saving) {
      return;
    }

    const result = validateQuizInput({
      title,
      questions: questions.map((q) => ({
        text: q.text,
        options: q.options,
        correct: q.correct,
        time: q.time.trim() === "" ? Number.NaN : Number(q.time),
      })),
    });
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
        setQuestions([blank(nextKey.current++)]);
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
          <fieldset
            key={question.key}
            className="flex flex-col gap-3 rounded-md bg-white p-4 text-sh-ink shadow-[0_4px_0_var(--sh-navy)]"
          >
            <legend className="sr-only">Question {index + 1}</legend>
            <div className="flex items-center justify-between">
              <b>Question {index + 1}</b>
              {questions.length > 1 ? (
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => {
                    setQuestions((current) => current.filter((q) => q.key !== question.key));
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              className={INPUT}
              aria-label={`Question ${index + 1} text`}
              placeholder="Question"
              maxLength={QUESTION_TEXT_MAX}
              value={question.text}
              onChange={(event) => {
                update(question.key, (q) => ({ ...q, text: event.target.value }));
              }}
            />
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.key}`}
                  className="size-5 accent-sh-blue"
                  aria-label={`Answer ${optionIndex + 1} is correct`}
                  checked={question.correct === optionIndex}
                  onChange={() => {
                    update(question.key, (q) => ({ ...q, correct: optionIndex }));
                  }}
                />
                <span
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded text-white ${SWATCHES[optionIndex]}`}
                >
                  {SHAPES[optionIndex]}
                </span>
                <input
                  className={INPUT}
                  aria-label={`Question ${index + 1} answer ${optionIndex + 1}`}
                  placeholder={`Answer ${optionIndex + 1}`}
                  maxLength={OPTION_TEXT_MAX}
                  value={option}
                  onChange={(event) => {
                    update(question.key, (q) => ({
                      ...q,
                      options: q.options.map((o, i) => (i === optionIndex ? event.target.value : o)),
                    }));
                  }}
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              Time (seconds)
              <input
                type="number"
                inputMode="numeric"
                min={QUESTION_TIME_MIN}
                max={QUESTION_TIME_MAX}
                className="h-9 w-24 rounded border-2 border-line bg-white px-2 text-base"
                value={question.time}
                onChange={(event) => {
                  update(question.key, (q) => ({ ...q, time: event.target.value }));
                }}
              />
            </label>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <GoldButton
            type="button"
            className="sh-gold-join max-w-56"
            disabled={questions.length >= QUIZ_QUESTIONS_MAX}
            onClick={() => {
              setQuestions((current) => [...current, blank(nextKey.current++)]);
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
