"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { GameState } from "@/shared/events";
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
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
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

function Leaderboard({ board, limit }: { board: ClientGame["board"]; limit: number }) {
  return (
    <ol aria-label="Leaderboard" className="flex flex-col gap-2">
      {board.slice(0, limit).map((entry, index) => (
        <li
          key={`${entry.nickname}-${index}`}
          className="flex items-center justify-between gap-4 rounded-md bg-white px-4 py-2 text-lg text-sh-navy shadow-[0_3px_0_rgb(0_0_0/0.35)]"
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
        <h1 className="text-center text-4xl font-black">Final results</h1>
        {podium.length > 0 ? (
          <p className="text-center text-2xl">
            🏆 {podium[0]?.nickname} wins with {podium[0]?.score} points
          </p>
        ) : null}
        <Leaderboard board={game.board} limit={game.board.length} />
        <div className="mt-auto flex justify-center pb-4">
          <GoldButton type="button" className="sh-gold-join max-w-80" onClick={onNext}>
            Back to lobby
          </GoldButton>
        </div>
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
      <h1 className="rounded-md bg-white px-6 py-8 text-center text-3xl text-sh-navy shadow-[0_4px_0_var(--sh-navy)] sm:text-4xl">
        {question?.text}
      </h1>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Answers">
        {question?.options.map((option, index) => {
          const style = optionStyle(index);
          const dimmed = showResults && question.correct !== index;
          const count = game.counts?.[index];
          return (
            <li
              key={index}
              className={`flex min-h-24 items-center gap-4 rounded-md px-5 py-4 text-xl shadow-[0_4px_0_rgb(0_0_0/0.35)] ${style.className} ${dimmed ? "opacity-40" : ""}`}
            >
              <span aria-label={style.name} className="text-3xl">
                {style.shape}
              </span>
              <span className="flex-1 break-words">{option}</span>
              {showResults ? (
                <span className="flex items-center gap-2 text-2xl tabular-nums">
                  {question.correct === index ? <span aria-label="Correct answer">✓</span> : null}
                  <span aria-label="Answers">{count ?? 0}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showResults ? <Leaderboard board={game.board} limit={5} /> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pb-4">
        <p role="status" className="text-lg">
          {showResults ? "" : `${game.answered} of ${game.playerCount} answered`}
        </p>
        <GoldButton type="button" className="sh-gold-join max-w-80" onClick={onNext}>
          {showResults ? (isLast ? "Final results" : "Next question") : "Skip to answers"}
        </GoldButton>
      </div>
    </Frame>
  );
}

export function PlayerGame({
  game,
  onAnswer,
}: {
  game: ClientGame;
  onAnswer: (choice: number) => void;
}) {
  const me = game.me;
  const question = game.question;

  const footer = (
    <footer className="mt-auto flex items-center justify-between gap-4 rounded-md bg-sh-navy px-5 py-3 text-xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]">
      <span className="truncate">{me?.nickname}</span>
      <span className="rounded-md bg-sh-gold px-4 py-1 tabular-nums" aria-label={`Score ${me?.score ?? 0}`}>
        {me?.score ?? 0}
      </span>
    </footer>
  );

  if (game.phase === "podium") {
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Logo className="sh-logo-join" />
          <h1 className="text-4xl font-black">You finished #{me?.rank}</h1>
          <p className="text-2xl tabular-nums">{me?.score ?? 0} points</p>
          <p role="status" className="text-lg">
            Waiting for the host…
          </p>
        </div>
        {footer}
      </Frame>
    );
  }

  if (game.phase === "results") {
    const answered = me?.answered ?? false;
    const headline = !answered ? "Time’s up" : me?.correct ? "Correct!" : "Incorrect";
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 role="status" className="text-5xl font-black">
            {headline}
          </h1>
          <p className="text-3xl tabular-nums">+{me?.gained ?? 0}</p>
          <p className="text-xl">
            You are #{me?.rank} of {game.playerCount}
          </p>
          {question && question.correct !== null && !me?.correct ? (
            <p className="rounded-md bg-sh-navy px-4 py-2 text-lg">
              Correct answer: {question.options[question.correct]}
            </p>
          ) : null}
        </div>
        {footer}
      </Frame>
    );
  }

  const answered = me?.answered ?? false;
  return (
    <Frame>
      <Bar>
        <span>
          {game.index + 1} / {game.total}
        </span>
        <Countdown game={game} />
      </Bar>
      <h1 className="rounded-md bg-white px-4 py-4 text-center text-2xl text-sh-navy shadow-[0_4px_0_var(--sh-navy)]">
        {question?.text}
      </h1>
      {answered ? (
        <p role="status" className="flex flex-1 items-center justify-center text-center text-2xl">
          Answer locked in. Waiting for the others…
        </p>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {question?.options.map((option, index) => {
            const style = optionStyle(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onAnswer(index);
                }}
                className={`flex min-h-24 items-center gap-4 rounded-md px-5 py-4 text-left text-xl shadow-[0_4px_0_rgb(0_0_0/0.35)] active:translate-y-0.5 ${style.className}`}
              >
                <span aria-label={style.name} className="text-3xl">
                  {style.shape}
                </span>
                <span className="break-words">{option}</span>
              </button>
            );
          })}
        </div>
      )}
      {footer}
    </Frame>
  );
}
