import { connection } from "next/server";
import { QUIZ_ERRORS, validateQuizInput } from "@/shared/quiz";
import { MAX_STORED_QUIZZES, getQuizStore } from "@/server/quizzes";

const MAX_BODY_BYTES = 256 * 1024;
const NO_STORE = { "Cache-Control": "no-store" } as const;

function failure(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

// `cacheComponents` rejects `dynamic = "force-dynamic"`, so `connection()` opts out per request.
export async function GET(): Promise<Response> {
  await connection();

  try {
    return Response.json(getQuizStore().list(), { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Failed to list quizzes", error);
    return failure("Couldn't load quizzes.", 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return failure(QUIZ_ERRORS.invalid, 415);
  }

  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return failure(QUIZ_ERRORS.tooLong, 413);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return failure(QUIZ_ERRORS.tooLong, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failure(QUIZ_ERRORS.invalid, 400);
  }

  const result = validateQuizInput(body);
  if (!result.ok) {
    return failure(result.message, 400);
  }

  try {
    const store = getQuizStore();
    if (store.count() >= MAX_STORED_QUIZZES) {
      return failure("The quiz library is full.", 409);
    }

    return Response.json({ id: store.create(result.quiz) }, { status: 201, headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Failed to save quiz", error);
    return failure("Couldn't save the quiz.", 500);
  }
}
