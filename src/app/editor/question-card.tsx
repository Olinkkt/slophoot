"use client";

import { Plus, X } from "lucide-react";
import type { PointsMode } from "@/shared/events";
import {
  EXPLANATION_MAX,
  IMAGE_URL_MAX,
  ITEMS_MAX,
  ITEMS_MIN,
  OPTIONS_MAX,
  OPTIONS_MIN,
  OPTION_TEXT_MAX,
  QUESTION_TEXT_MAX,
  QUESTION_TIME_MAX,
  QUESTION_TIME_MIN,
  TEXT_ANSWERS_MAX,
  TEXT_ANSWER_MAX,
} from "@/shared/quiz";
import { TYPE_HINTS, TYPE_LABELS, type Draft, type DraftType } from "./draft";

const SHAPES = ["▲", "◆", "●", "■"];
const SWATCHES = ["bg-[#c8102e]", "bg-[#1368ce]", "bg-[#a87400]", "bg-[#26890c]"];
const INPUT =
  "h-11 w-full rounded border-2 border-line bg-white px-3 text-base text-sh-ink placeholder:text-[#767676]";
const SMALL_INPUT = "h-9 rounded border-2 border-line bg-white px-2 text-base text-sh-ink";
const ICON_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded border-2 border-line text-sh-ink disabled:opacity-30";
const ADD_BUTTON = "flex items-center gap-1 self-start text-sm underline disabled:no-underline disabled:opacity-40";

type Props = {
  draft: Draft;
  index: number;
  canRemove: boolean;
  onChange: (change: (draft: Draft) => Draft) => void;
  onRemove: () => void;
};

function swatch(index: number) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-11 shrink-0 place-items-center rounded text-white ${SWATCHES[index % SWATCHES.length]}`}
    >
      {SHAPES[index % SHAPES.length]}
    </span>
  );
}

export function QuestionCard({ draft, index, canRemove, onChange, onRemove }: Props) {
  const label = `Question ${index + 1}`;
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  const setOption = (at: number, value: string) => {
    onChange((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === at ? value : option)),
    }));
  };

  const addOption = () => {
    onChange((current) => ({ ...current, options: [...current.options, ""] }));
  };

  const removeOption = (at: number) => {
    onChange((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== at),
      correct: current.correct === at ? 0 : current.correct > at ? current.correct - 1 : current.correct,
      corrects: current.corrects.filter((i) => i !== at).map((i) => (i > at ? i - 1 : i)),
    }));
  };

  const optionRows = (kind: "radio" | "checkbox" | "none") => (
    <>
      {draft.options.map((option, optionIndex) => (
        <div key={optionIndex} className="flex items-center gap-2">
          {kind === "radio" ? (
            <input
              type="radio"
              name={`correct-${draft.key}`}
              className="size-5 accent-sh-blue"
              aria-label={`Answer ${optionIndex + 1} is correct`}
              checked={draft.correct === optionIndex}
              onChange={() => {
                set("correct", optionIndex);
              }}
            />
          ) : null}
          {kind === "checkbox" ? (
            <input
              type="checkbox"
              className="size-5 accent-sh-blue"
              aria-label={`Answer ${optionIndex + 1} is correct`}
              checked={draft.corrects.includes(optionIndex)}
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  corrects: event.target.checked
                    ? [...current.corrects, optionIndex]
                    : current.corrects.filter((i) => i !== optionIndex),
                }));
              }}
            />
          ) : null}
          {swatch(optionIndex)}
          <input
            className={INPUT}
            aria-label={`${label} answer ${optionIndex + 1}`}
            placeholder={`Answer ${optionIndex + 1}`}
            maxLength={OPTION_TEXT_MAX}
            value={option}
            onChange={(event) => {
              setOption(optionIndex, event.target.value);
            }}
          />
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label={`Remove answer ${optionIndex + 1}`}
            disabled={draft.options.length <= OPTIONS_MIN}
            onClick={() => {
              removeOption(optionIndex);
            }}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      ))}
      <button type="button" className={ADD_BUTTON} disabled={draft.options.length >= OPTIONS_MAX} onClick={addOption}>
        <Plus aria-hidden="true" size={16} /> Add answer
      </button>
    </>
  );

  const body = () => {
    switch (draft.type) {
      case "choice":
        return optionRows("radio");
      case "multi":
        return optionRows("checkbox");
      case "poll":
        return optionRows("none");
      case "truefalse":
        return (
          <fieldset className="flex gap-6">
            <legend className="sr-only">Right answer</legend>
            {["True", "False"].map((answer, answerIndex) => (
              <label key={answer} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${draft.key}`}
                  className="size-5 accent-sh-blue"
                  checked={draft.correct === answerIndex}
                  onChange={() => {
                    set("correct", answerIndex);
                  }}
                />
                {answer} is right
              </label>
            ))}
          </fieldset>
        );
      case "text":
        return (
          <>
            {draft.answers.map((answer, answerIndex) => (
              <div key={answerIndex} className="flex items-center gap-2">
                <input
                  className={INPUT}
                  aria-label={`${label} accepted answer ${answerIndex + 1}`}
                  placeholder={answerIndex === 0 ? "Right answer" : "Another accepted answer"}
                  maxLength={TEXT_ANSWER_MAX}
                  value={answer}
                  onChange={(event) => {
                    onChange((current) => ({
                      ...current,
                      answers: current.answers.map((a, i) => (i === answerIndex ? event.target.value : a)),
                    }));
                  }}
                />
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Remove accepted answer ${answerIndex + 1}`}
                  disabled={draft.answers.length <= 1}
                  onClick={() => {
                    onChange((current) => ({ ...current, answers: current.answers.filter((_, i) => i !== answerIndex) }));
                  }}
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={ADD_BUTTON}
              disabled={draft.answers.length >= TEXT_ANSWERS_MAX}
              onClick={() => {
                onChange((current) => ({ ...current, answers: [...current.answers, ""] }));
              }}
            >
              <Plus aria-hidden="true" size={16} /> Add another accepted answer
            </button>
          </>
        );
      case "slider":
        return (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["min", "Smallest number"],
                ["max", "Biggest number"],
                ["target", "Right answer"],
                ["tolerance", "Counts as right within ±"],
              ] as const
            ).map(([field, text]) => (
              <label key={field} className="flex flex-col gap-1">
                {text}
                <input
                  type="number"
                  inputMode="numeric"
                  className={`${SMALL_INPUT} w-full`}
                  value={draft[field]}
                  onChange={(event) => {
                    set(field, event.target.value);
                  }}
                />
              </label>
            ))}
          </div>
        );
      case "order":
        return (
          <>
            {draft.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <span aria-hidden="true" className="w-6 text-right tabular-nums">
                  {itemIndex + 1}.
                </span>
                <input
                  className={INPUT}
                  aria-label={`${label} item ${itemIndex + 1}`}
                  placeholder={`Item ${itemIndex + 1}`}
                  maxLength={OPTION_TEXT_MAX}
                  value={item}
                  onChange={(event) => {
                    onChange((current) => ({
                      ...current,
                      items: current.items.map((entry, i) => (i === itemIndex ? event.target.value : entry)),
                    }));
                  }}
                />
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Remove item ${itemIndex + 1}`}
                  disabled={draft.items.length <= ITEMS_MIN}
                  onClick={() => {
                    onChange((current) => ({ ...current, items: current.items.filter((_, i) => i !== itemIndex) }));
                  }}
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={ADD_BUTTON}
              disabled={draft.items.length >= ITEMS_MAX}
              onClick={() => {
                onChange((current) => ({ ...current, items: [...current.items, ""] }));
              }}
            >
              <Plus aria-hidden="true" size={16} /> Add item
            </button>
          </>
        );
      case "pairs":
        return (
          <>
            {draft.pairs.map((pair, pairIndex) => (
              <div key={pairIndex} className="flex items-center gap-2">
                <input
                  className={INPUT}
                  aria-label={`${label} pair ${pairIndex + 1} left`}
                  placeholder="Left"
                  maxLength={OPTION_TEXT_MAX}
                  value={pair.left}
                  onChange={(event) => {
                    onChange((current) => ({
                      ...current,
                      pairs: current.pairs.map((p, i) => (i === pairIndex ? { ...p, left: event.target.value } : p)),
                    }));
                  }}
                />
                <span aria-hidden="true">↔</span>
                <input
                  className={INPUT}
                  aria-label={`${label} pair ${pairIndex + 1} right`}
                  placeholder="Right"
                  maxLength={OPTION_TEXT_MAX}
                  value={pair.right}
                  onChange={(event) => {
                    onChange((current) => ({
                      ...current,
                      pairs: current.pairs.map((p, i) => (i === pairIndex ? { ...p, right: event.target.value } : p)),
                    }));
                  }}
                />
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Remove pair ${pairIndex + 1}`}
                  disabled={draft.pairs.length <= ITEMS_MIN}
                  onClick={() => {
                    onChange((current) => ({ ...current, pairs: current.pairs.filter((_, i) => i !== pairIndex) }));
                  }}
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={ADD_BUTTON}
              disabled={draft.pairs.length >= ITEMS_MAX}
              onClick={() => {
                onChange((current) => ({ ...current, pairs: [...current.pairs, { left: "", right: "" }] }));
              }}
            >
              <Plus aria-hidden="true" size={16} /> Add pair
            </button>
          </>
        );
    }
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-md bg-white p-4 text-sh-ink shadow-[0_4px_0_var(--sh-navy)]">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between gap-3">
        <b>{label}</b>
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor={`type-${draft.key}`}>
            {label} type
          </label>
          <select
            id={`type-${draft.key}`}
            className={SMALL_INPUT}
            value={draft.type}
            onChange={(event) => {
              set("type", event.target.value as DraftType);
            }}
          >
            {(Object.keys(TYPE_LABELS) as DraftType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {canRemove ? (
            <button type="button" className="text-sm underline" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <p className="-mt-2 text-sm text-[#555]">{TYPE_HINTS[draft.type]}</p>
      <input
        className={INPUT}
        aria-label={`${label} text`}
        placeholder="Question"
        maxLength={QUESTION_TEXT_MAX}
        value={draft.text}
        onChange={(event) => {
          set("text", event.target.value);
        }}
      />
      <input
        className={INPUT}
        type="url"
        aria-label={`${label} picture link`}
        placeholder="Picture link (optional, https)"
        maxLength={IMAGE_URL_MAX}
        value={draft.image}
        onChange={(event) => {
          set("image", event.target.value);
        }}
      />
      {body()}
      <input
        className={INPUT}
        aria-label={`${label} explanation`}
        placeholder="Explanation shown after the answer (optional)"
        maxLength={EXPLANATION_MAX}
        value={draft.explanation}
        onChange={(event) => {
          set("explanation", event.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          Time (seconds)
          <input
            type="number"
            inputMode="numeric"
            min={QUESTION_TIME_MIN}
            max={QUESTION_TIME_MAX}
            className={`${SMALL_INPUT} w-24`}
            value={draft.time}
            onChange={(event) => {
              set("time", event.target.value);
            }}
          />
        </label>
        {draft.type === "poll" ? null : (
          <label className="flex items-center gap-2">
            Points
            <select
              className={SMALL_INPUT}
              value={draft.points}
              onChange={(event) => {
                set("points", event.target.value as PointsMode);
              }}
            >
              <option value="standard">Standard</option>
              <option value="double">Double</option>
              <option value="none">None</option>
            </select>
          </label>
        )}
      </div>
    </fieldset>
  );
}
