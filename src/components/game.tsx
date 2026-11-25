"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TEXT_INPUT_MAX } from "@/shared/quiz";
import type { AnswerValue, GameQuestion, GameState } from "@/shared/events";
import { GoldButton, Logo } from "@/components/stage";

/** A game state plus the client time it arrived, so the countdown can run locally. */
export type ClientGame = GameState & { receivedAt: number };

const OPTION_STYLES = [
  { shape: "▲", name: "Red triangle", className: "bg-[#c8102e]" },
  { shape: "◆", name: "Blue diamond", className: "bg-[#1368ce]" },
  { shape: "●", name: "Gold circle", className: "bg-[#a87400]" },
  { shape: "■", name: "Green square", className: "bg-[#26890c]" },
] as const;

function optionStyle(index: number) {
  return OPTION_STYLES[index % OPTION_STYLES.length] ?? OPTION_STYLES[0];
}

function useRemainingMs(game: ClientGame): number {
  const [now, setNow] = useState(0);
  const running = game.phase === "question";

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 200);
    return () => {
      clearInterval(timer);
    };
  }, [running, game.receivedAt]);

  if (!running) {
    return 0;
  }

  return Math.max(0, game.leftMs - Math.max(0, now - game.receivedAt));
}

function Countdown({ game }: { game: ClientGame }) {
  const remaining = useRemainingMs(game);
  const total = (game.question?.time ?? 0) * 1000;
  const percent = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;

  return (
    <div className="flex min-w-32 items-center gap-3">
      <span role="timer" aria-label="Seconds left" className="w-10 text-right text-2xl tabular-nums">
        {Math.ceil(remaining / 1000)}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
        <div
          className="sh-timer h-full w-full rounded-full bg-white"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0 round 999px)` }}
        />
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-1 mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-5">
      {children}
    </main>
  );
}

function Bar({ children }: { children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md bg-sh-navy px-5 py-3 text-lg shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]">
      {children}
    </header>
  );
}

const FIELD =
  "h-12 w-full rounded-md border-2 border-white/40 bg-white px-3 text-lg text-sh-navy placeholder:text-[#767676]";

/** Whether option `index` is a right answer. Always false for questions without option tiles. */
function isRightOption(question: GameQuestion, index: number): boolean {
  const reveal = question.reveal;
  if (reveal?.type === "choice") {
    return reveal.correct === index;
  }
  return reveal?.type === "multi" && reveal.correct.includes(index);
}

/** The right answer as one line of text. Empty for polls. */
function describeReveal(question: GameQuestion): string {
  const reveal = question.reveal;
  switch (reveal?.type) {
    case "choice":
      return question.options[reveal.correct] ?? "";
    case "multi":
      return reveal.correct.map((index) => question.options[index]).join(", ");
    case "text":
      return reveal.answers.join(" or ");
    case "slider":
      return reveal.tolerance > 0 ? `${reveal.correct} (within ${reveal.tolerance} counts)` : `${reveal.correct}`;
    case "order":
      return reveal.items.join(" → ");
    case "pairs":
      return reveal.pairs.map((pair) => `${pair.left} → ${pair.right}`).join(", ");
    default:
      return "";
  }
}

function PointsBadge({ question }: { question: GameQuestion }) {
  if (question.type === "poll") {
    return <span className="sh-badge">Poll · no points</span>;
  }
  if (question.points === "double") {
    return <span className="sh-badge">Double points</span>;
  }
  return question.points === "none" ? <span className="sh-badge">No points</span> : null;
}

function QuestionImage({ question }: { question: GameQuestion }) {
  if (!question.image) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Hosts paste any https image URL.
    <img
      src={question.image}
      alt=""
      referrerPolicy="no-referrer"
      className="mx-auto max-h-64 w-auto max-w-full rounded-md bg-white object-contain"
    />
  );
}

function Explanation({ question }: { question: GameQuestion }) {
  return question.explanation ? (
    <p className="rounded-md bg-white px-4 py-3 text-center text-lg text-sh-navy">{question.explanation}</p>
  ) : null;
}

/** Podium order: everyone below 3rd first, then 3rd, 2nd, 1st, 60ms apart. */
function riseDelay(index: number): number {
  return index >= 3 ? 0 : (3 - index) * 60;
}

function Leaderboard({
  board,
  limit,
  celebrate = false,
}: {
  board: ClientGame["board"];
  limit: number;
  celebrate?: boolean;
}) {
  return (
    <ol aria-label="Leaderboard" className="flex flex-col gap-2">
      {board.slice(0, limit).map((entry, index) => (
        <li
          key={`${entry.nickname}-${index}`}
          style={celebrate ? { animationDelay: `${riseDelay(index)}ms` } : undefined}
          className={`flex items-center justify-between gap-4 rounded-md bg-white px-4 py-2 text-lg text-sh-navy shadow-[0_3px_0_rgb(0_0_0/0.35)] ${celebrate ? "sh-rise" : ""} ${celebrate && index === 0 ? "sh-rise-winner" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="w-6 text-right tabular-nums">{index + 1}</span>
            <span className="truncate">{entry.nickname}</span>
          </span>
          <span className="tabular-nums">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** Remounts on every phase or question change so the content fades in fresh. */
function Phase({ children }: { children: ReactNode }) {
  return <div className="sh-phase flex flex-1 flex-col gap-5">{children}</div>;
}

function phaseKey(game: ClientGame): string {
  return `${game.phase}-${game.index}`;
}

export function HostGame({ game, onNext }: { game: ClientGame; onNext: () => void }) {
  const question = game.question;

  if (game.phase === "podium") {
    const podium = game.board.slice(0, 3);
    return (
      <Frame>
        <Bar>
          <span>{game.title}</span>
          <span>PIN {game.pin}</span>
        </Bar>
        <Phase key={phaseKey(game)}>
          <h1 className="text-center text-4xl font-black">Final results</h1>
          {podium.length > 0 ? (
            <p className="sh-pop text-center text-2xl" style={{ animationDelay: "240ms" }}>
              🏆 {podium[0]?.nickname} wins with {podium[0]?.score} points
            </p>
          ) : null}
          <Leaderboard board={game.board} limit={game.board.length} celebrate />
          <div className="mt-auto flex justify-center pb-4">
            <GoldButton type="button" className="sh-gold-join max-w-80" onClick={onNext}>
              Back to lobby
            </GoldButton>
          </div>
        </Phase>
      </Frame>
    );
  }

  const showResults = game.phase === "results";
  const isLast = game.index + 1 >= game.total;

  return (
    <Frame>
      <Bar>
        <span>
          Question {game.index + 1} of {game.total}
        </span>
        <span>PIN {game.pin}</span>
        {showResults ? null : <Countdown game={game} />}
      </Bar>
      <Phase key={phaseKey(game)}>
        {question ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <PointsBadge question={question} />
              <h1 className="w-full rounded-md bg-white px-6 py-8 text-center text-3xl text-sh-navy shadow-[0_4px_0_var(--sh-navy)] sm:text-4xl">
                {question.text}
              </h1>
            </div>
            <QuestionImage question={question} />
            <HostAnswers game={game} question={question} showResults={showResults} />
            {showResults ? <HostSummary game={game} question={question} /> : null}
          </>
        ) : null}
        {showResults ? <Leaderboard board={game.board} limit={5} /> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pb-4">
          <p role="status" className="text-lg">
            {showResults ? "" : `${game.answered} of ${game.playerCount} answered`}
          </p>
          <GoldButton type="button" className="sh-gold-join max-w-80" onClick={onNext}>
            {showResults ? (isLast ? "Final results" : "Next question") : "Skip to answers"}
          </GoldButton>
        </div>
      </Phase>
    </Frame>
  );
}

function HostAnswers({
  game,
  question,
  showResults,
}: {
  game: ClientGame;
  question: GameQuestion;
  showResults: boolean;
}) {
  const panel = "rounded-md bg-white/15 px-5 py-4 text-center text-xl";

  if (question.options.length > 0) {
    const hasAnswer = question.type !== "poll";
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Answers">
        {question.options.map((option, index) => {
          const style = optionStyle(index);
          const right = isRightOption(question, index);
          const dimmed = showResults && hasAnswer && !right;
          const count = game.counts?.[index];
          return (
            <li
              key={index}
              className={`sh-tile flex min-h-24 items-center gap-4 rounded-md px-5 py-4 text-xl shadow-[0_4px_0_rgb(0_0_0/0.35)] ${style.className} ${dimmed ? "opacity-40" : ""} ${showResults && hasAnswer && right ? "sh-reveal" : ""}`}
            >
              <span aria-label={style.name} className="text-3xl">
                {style.shape}
              </span>
              <span className="flex-1 break-words">{option}</span>
              {showResults ? (
                <span className="flex items-center gap-2 text-2xl tabular-nums">
                  {right ? <span aria-label="Correct answer">✓</span> : null}
                  <span aria-label="Answers">{count ?? 0}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  if (question.type === "text") {
    return <p className={panel}>Players are typing their answers…</p>;
  }

  if (question.type === "slider" && question.range) {
    return (
      <p className={`${panel} tabular-nums`}>
        Guess a number from {question.range.min} to {question.range.max}
      </p>
    );
  }

  if (question.type === "order") {
    const items = question.reveal?.type === "order" ? question.reveal.items : question.items;
    return (
      <ol aria-label="Items to put in order" className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex items-center gap-4 rounded-md bg-white/15 px-5 py-4 text-xl">
            {question.reveal ? <span className="tabular-nums">{index + 1}.</span> : null}
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (question.type === "pairs") {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Items to match">
        <ul className="flex flex-col gap-3">
          {question.items.map((item, index) => (
            <li key={index} className="rounded-md bg-white/15 px-5 py-4 text-xl">
              {item}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-3">
          {(question.reveal?.type === "pairs" ? question.reveal.pairs.map((pair) => pair.right) : question.matches).map(
            (item, index) => (
              <li key={index} className="rounded-md bg-white/15 px-5 py-4 text-xl">
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    );
  }

  return null;
}

function HostSummary({ game, question }: { game: ClientGame; question: GameQuestion }) {
  const answer = describeReveal(question);
  const showAnswer = answer !== "" && question.options.length === 0;
  return (
    <div className="flex flex-col gap-3 text-center">
      {showAnswer ? (
        <p className="rounded-md bg-sh-navy px-5 py-3 text-xl">
          {question.type === "pairs" || question.type === "order" ? "Right answer" : "Answer"}: {answer}
        </p>
      ) : null}
      {game.correctCount !== null ? (
        <p role="status" className="text-lg">
          {game.correctCount} of {game.playerCount} got it right
        </p>
      ) : null}
      <Explanation question={question} />
    </div>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  return (
    <GoldButton type="submit" className="sh-gold-join" disabled={disabled}>
      Lock in
    </GoldButton>
  );
}

function OptionTiles({
  question,
  picked,
  onPick,
  locked = false,
}: {
  question: GameQuestion;
  picked: number[];
  onPick: (index: number) => void;
  /** The answer is sent: tiles stop responding and the unpicked ones dim. */
  locked?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {question.options.map((option, index) => {
        const style = optionStyle(index);
        const on = picked.includes(index);
        const fade = locked ? (on ? "" : "opacity-40") : question.type === "multi" && !on ? "opacity-60" : "";
        return (
          <button
            key={index}
            type="button"
            disabled={locked}
            aria-pressed={question.type === "multi" || locked ? on : undefined}
            onClick={() => {
              onPick(index);
            }}
            className={`sh-tile flex min-h-24 items-center gap-4 rounded-md px-5 py-4 text-left text-xl shadow-[0_4px_0_rgb(0_0_0/0.35)] ${style.className} ${fade} ${on ? "ring-4 ring-white" : ""}`}
          >
            <span aria-label={style.name} className="text-3xl">
              {style.shape}
            </span>
            <span className="flex-1 break-words">{option}</span>
            {on ? <span aria-label="Selected">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function MultiInput({
  question,
  locked,
  onAnswer,
}: {
  question: GameQuestion;
  locked: boolean;
  onAnswer: (answer: AnswerValue) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <form
      className="flex flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked.length > 0) {
          onAnswer(picked);
        }
      }}
    >
      <p className="text-center text-lg">Pick every right answer</p>
      <OptionTiles
        question={question}
        picked={picked}
        locked={locked}
        onPick={(index) => {
          setPicked((current) =>
            current.includes(index) ? current.filter((value) => value !== index) : [...current, index],
          );
        }}
      />
      {locked ? null : <SubmitButton disabled={picked.length === 0} />}
    </form>
  );
}

function TextInput({ onAnswer }: { onAnswer: (answer: AnswerValue) => void }) {
  const [value, setValue] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() !== "") {
      onAnswer(value);
    }
  };

  return (
    <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={submit}>
      <label htmlFor="text-answer" className="sr-only">
        Your answer
      </label>
      <input
        id="text-answer"
        className={FIELD}
        placeholder="Type your answer"
        maxLength={TEXT_INPUT_MAX}
        autoComplete="off"
        autoCapitalize="off"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      <SubmitButton disabled={value.trim() === ""} />
    </form>
  );
}

function SliderInput({
  min,
  max,
  onAnswer,
}: {
  min: number;
  max: number;
  onAnswer: (answer: AnswerValue) => void;
}) {
  const [value, setValue] = useState(String(Math.round((min + max) / 2)));
  const number = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(number) && number >= min && number <= max;
  return (
    <form
      className="flex flex-1 flex-col justify-center gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onAnswer(number);
        }
      }}
    >
      <p className="text-center text-5xl tabular-nums" aria-hidden="true">
        {valid ? number : "?"}
      </p>
      <input
        type="range"
        aria-label="Your guess"
        min={min}
        max={max}
        step={1}
        value={valid ? number : min}
        className="h-10 w-full accent-white"
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      <div className="flex justify-between text-lg tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <label className="flex items-center justify-center gap-3 text-lg">
        Exact number
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className={`${FIELD} w-40`}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </label>
      <SubmitButton disabled={!valid} />
    </form>
  );
}

function OrderInput({ question, onAnswer }: { question: GameQuestion; onAnswer: (answer: AnswerValue) => void }) {
  const [order, setOrder] = useState(() => question.items.map((_, index) => index));
  const move = (from: number, to: number) => {
    setOrder((current) => {
      if (to < 0 || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [held] = next.splice(from, 1);
      next.splice(to, 0, held ?? 0);
      return next;
    });
  };

  return (
    <form
      className="flex flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onAnswer(order);
      }}
    >
      <p className="text-center text-lg">Put these in the right order</p>
      <ol className="flex flex-col gap-2">
        {order.map((shown, position) => (
          <li key={shown} className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-lg text-sh-navy">
            <span className="w-6 tabular-nums">{position + 1}.</span>
            <span className="flex-1 break-words">{question.items[shown]}</span>
            <button
              type="button"
              aria-label={`Move ${question.items[shown]} up`}
              disabled={position === 0}
              className="sh-press grid size-10 place-items-center rounded bg-sh-navy text-white disabled:opacity-30"
              onClick={() => {
                move(position, position - 1);
              }}
            >
              <ArrowUp aria-hidden="true" size={20} />
            </button>
            <button
              type="button"
              aria-label={`Move ${question.items[shown]} down`}
              disabled={position === order.length - 1}
              className="sh-press grid size-10 place-items-center rounded bg-sh-navy text-white disabled:opacity-30"
              onClick={() => {
                move(position, position + 1);
              }}
            >
              <ArrowDown aria-hidden="true" size={20} />
            </button>
          </li>
        ))}
      </ol>
      <SubmitButton />
    </form>
  );
}

function PairsInput({ question, onAnswer }: { question: GameQuestion; onAnswer: (answer: AnswerValue) => void }) {
  const [chosen, setChosen] = useState<Array<number | null>>(() => question.items.map(() => null));
  const complete = chosen.every((value) => value !== null);
  return (
    <form
      className="flex flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) {
          onAnswer(chosen as number[]);
        }
      }}
    >
      <p className="text-center text-lg">Match each one</p>
      {question.items.map((left, leftIndex) => (
        <label key={leftIndex} className="flex flex-col gap-1 rounded-md bg-white/15 px-4 py-3 text-lg">
          {left}
          <select
            className={FIELD}
            value={chosen[leftIndex] ?? ""}
            onChange={(event) => {
              const value = event.target.value === "" ? null : Number(event.target.value);
              setChosen((current) => current.map((entry, index) => (index === leftIndex ? value : entry)));
            }}
          >
            <option value="">Choose…</option>
            {question.matches.map((right, rightIndex) => (
              <option
                key={rightIndex}
                value={rightIndex}
                disabled={chosen.some((entry, index) => entry === rightIndex && index !== leftIndex)}
              >
                {right}
              </option>
            ))}
          </select>
        </label>
      ))}
      <SubmitButton disabled={!complete} />
    </form>
  );
}

/** Question types answered by tapping option tiles. These stay on screen, dimmed, after locking in. */
function hasTiles(question: GameQuestion): boolean {
  return question.type === "choice" || question.type === "poll" || question.type === "multi";
}

function pickedIndices(choice: AnswerValue | null | undefined): number[] {
  if (typeof choice === "number") {
    return [choice];
  }
  return Array.isArray(choice) ? choice : [];
}

function AnswerInput({
  question,
  locked,
  choice,
  onAnswer,
}: {
  question: GameQuestion;
  locked: boolean;
  choice: AnswerValue | null | undefined;
  onAnswer: (answer: AnswerValue) => void;
}) {
  switch (question.type) {
    case "choice":
    case "poll":
      return (
        <div className="flex-1">
          <OptionTiles
            question={question}
            picked={locked ? pickedIndices(choice) : []}
            locked={locked}
            onPick={onAnswer}
          />
        </div>
      );
    case "multi":
      return <MultiInput question={question} locked={locked} onAnswer={onAnswer} />;
    case "text":
      return <TextInput onAnswer={onAnswer} />;
    case "slider":
      return question.range ? (
        <SliderInput min={question.range.min} max={question.range.max} onAnswer={onAnswer} />
      ) : null;
    case "order":
      return <OrderInput question={question} onAnswer={onAnswer} />;
    case "pairs":
      return <PairsInput question={question} onAnswer={onAnswer} />;
  }
}

export function PlayerGame({
  game,
  onAnswer,
}: {
  game: ClientGame;
  onAnswer: (answer: AnswerValue) => void;
}) {
  return (
    <Frame>
      <Phase key={phaseKey(game)}>
        <PlayerPhase game={game} onAnswer={onAnswer} />
      </Phase>
      {/* Outside the phase wrapper so it stays mounted and the score can count up. */}
      <footer className="mt-auto flex items-center justify-between gap-4 rounded-md bg-sh-navy px-5 py-3 text-xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]">
        <span className="truncate">{game.me?.nickname}</span>
        <ScoreChip score={game.me?.score ?? 0} />
      </footer>
    </Frame>
  );
}

const COUNT_UP_MS = 600;

/** Counts up to the new score and nudges once whenever it changes. */
function ScoreChip({ score }: { score: number }) {
  const [shown, setShown] = useState(score);
  const chip = useRef<HTMLSpanElement>(null);
  const current = useRef(score);

  useEffect(() => {
    const start = current.current;
    if (start === score) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      chip.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
        { duration: 300, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }

    const duration = reduce ? 0 : COUNT_UP_MS;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(start + (score - start) * eased);
      current.current = value;
      setShown(value);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [score]);

  return (
    <span ref={chip} className="inline-block rounded-md bg-sh-gold px-4 py-1 tabular-nums" aria-label={`Score ${score}`}>
      {shown}
    </span>
  );
}

function PlayerPhase({ game, onAnswer }: { game: ClientGame; onAnswer: (answer: AnswerValue) => void }) {
  const me = game.me;
  const question = game.question;

  if (game.phase === "podium") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Logo className="sh-logo-join" />
        <h1 className="sh-pop text-4xl font-black">You finished #{me?.rank}</h1>
        <p className="text-2xl tabular-nums">{me?.score ?? 0} points</p>
        <p role="status" className="text-lg">
          Waiting for the host…
        </p>
      </div>
    );
  }

  if (game.phase === "results") {
    const answered = me?.answered ?? false;
    const isPoll = question?.type === "poll";
    const gained = me?.gained ?? 0;
    const headline = isPoll
      ? answered
        ? "Vote counted"
        : "Time’s up"
      : !answered
        ? "Time’s up"
        : me?.correct
          ? "Correct!"
          : gained > 0
            ? "Partly right"
            : "Incorrect";
    const answer = question ? describeReveal(question) : "";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 role="status" className="sh-pop text-5xl font-black">
          {headline}
        </h1>
        {isPoll ? null : (
          <p className="sh-pop text-3xl tabular-nums" style={{ animationDelay: "80ms" }}>
            +{gained}
          </p>
        )}
        {question?.points === "none" && !isPoll ? <p className="text-lg">No points on this one</p> : null}
        <p className="text-xl">
          You are #{me?.rank} of {game.playerCount}
        </p>
        {answer !== "" && !me?.correct ? (
          <p className="rounded-md bg-sh-navy px-4 py-2 text-lg">Right answer: {answer}</p>
        ) : null}
        {question ? <Explanation question={question} /> : null}
      </div>
    );
  }

  const answered = me?.answered ?? false;
  const keepTiles = question ? hasTiles(question) : false;
  return (
    <>
      <Bar>
        <span>
          {game.index + 1} / {game.total}
        </span>
        <Countdown game={game} />
      </Bar>
      {question ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <PointsBadge question={question} />
            <h1 className="w-full rounded-md bg-white px-4 py-4 text-center text-2xl text-sh-navy shadow-[0_4px_0_var(--sh-navy)]">
              {question.text}
            </h1>
          </div>
          <QuestionImage question={question} />
        </>
      ) : null}
      {question && (!answered || keepTiles) ? (
        <AnswerInput
          key={game.index}
          question={question}
          locked={answered}
          choice={me?.choice}
          onAnswer={onAnswer}
        />
      ) : null}
      {answered ? (
        <p
          role="status"
          className={
            keepTiles ? "sh-pop text-center text-xl" : "flex flex-1 items-center justify-center text-center text-2xl"
          }
        >
          Answer locked in. Waiting for the others…
        </p>
      ) : null}
    </>
  );
}
