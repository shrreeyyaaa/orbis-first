import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";
import { localAnswer, callLLM, hasLLM, DISCLAIMER, type ChatMessage } from "@/lib/assistant";

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "No question provided" }, { status: 400 });
  }

  const snapshot = await buildSnapshot();
  if (!snapshot) {
    return NextResponse.json({
      reply: "Finish setting up your household first, then I can answer questions about your finances.",
    });
  }

  let answer: string | null = null;
  if (hasLLM()) {
    answer = await callLLM(messages, snapshot);
  }
  if (!answer) {
    answer = localAnswer(lastUser.content, snapshot);
  }

  return NextResponse.json({ reply: `${answer}\n\n${DISCLAIMER}` });
}
