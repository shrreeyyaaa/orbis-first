import type { FinancialSnapshot } from "@/lib/snapshot";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const DISCLAIMER = "Informational only - not financial, tax, or legal advice.";

function money(snapshot: FinancialSnapshot, n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: snapshot.reportingCurrency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${snapshot.reportingCurrency}`;
  }
}

/**
 * Deterministic responder used when no LLM key is configured. Answers common
 * questions directly from the snapshot so the assistant is useful out of the box.
 */
export function localAnswer(question: string, s: FinancialSnapshot): string {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("net worth", "networth", "how much am i worth", "total wealth")) {
    return `Your net worth is ${money(s, s.netWorth)} - ${money(s, s.totalAssets)} in assets minus ${money(s, s.totalLiabilities)} in liabilities.`;
  }

  if (has("alloc", "diversif", "invested", "asset class", "portfolio")) {
    if (s.allocation.length === 0) return "You don't have any assets recorded yet.";
    const lines = s.allocation
      .slice(0, 6)
      .map((a) => `- ${a.group}: ${money(s, a.value)} (${a.pct}%)`)
      .join("\n");
    return `Here's your asset allocation:\n${lines}`;
  }

  if (has("saving", "save enough", "cash flow", "cashflow", "spend", "income", "expense", "budget")) {
    const rate = s.savingsRatePct == null ? "not enough income data to compute a savings rate" : `a savings rate of about ${s.savingsRatePct}%`;
    return `You bring in about ${money(s, s.annualIncome)}/year and spend about ${money(s, s.annualExpenses)}/year - ${money(s, s.monthlyNetCashFlow)}/month net, ${rate}.`;
  }

  if (has("goal")) {
    if (s.goals.length === 0) return "You haven't set any funded goals yet. You can add one on the Goals page.";
    const lines = s.goals.map((g) => `- ${g.name}: ${money(s, g.saved)} of ${money(s, g.target)} (${g.pct}%)`).join("\n");
    return `Your goals:\n${lines}`;
  }

  if (has("concentrat", "risk", "exposure", "biggest")) {
    const top = s.topHoldings[0];
    if (!top) return "You don't have any holdings recorded yet.";
    const pct = s.totalAssets > 0 ? Math.round((top.value / s.totalAssets) * 100) : 0;
    return `Your largest position is ${top.name} at ${money(s, top.value)} (~${pct}% of assets). A position above ~20% is worth watching for concentration risk.`;
  }

  if (has("health", "score", "how am i doing", "doing financially")) {
    const tip = s.insights[0];
    return `Your financial health score is ${s.healthScore}/100 (${s.healthTier}).${tip ? ` Biggest opportunity: ${tip.title} - ${tip.detail}` : ""}`;
  }

  if (has("insight", "improve", "recommend", "what should", "advice", "suggest")) {
    if (s.insights.length === 0) return "Nothing stands out right now - your basics look in order.";
    const lines = s.insights.slice(0, 3).map((i) => `- ${i.title}: ${i.detail}`).join("\n");
    return `A few things worth your attention:\n${lines}`;
  }

  if (has("owner", "who owns", "member", "family", "by person", "entity", "trust")) {
    if (s.byOwner.length === 0) return "No owners with holdings yet.";
    const lines = s.byOwner.map((o) => `- ${o.owner}: ${money(s, o.net)}`).join("\n");
    return `Net worth by member/entity:\n${lines}`;
  }

  if (has("holding", "top", "stock", "biggest assets")) {
    if (s.topHoldings.length === 0) return "No holdings recorded yet.";
    const lines = s.topHoldings.map((h) => `- ${h.name}: ${money(s, h.value)}`).join("\n");
    return `Your largest holdings:\n${lines}`;
  }

  return `Here's a quick summary: net worth ${money(s, s.netWorth)}, health score ${s.healthScore}/100 (${s.healthTier}), saving ${s.savingsRatePct ?? "?"}% of income. Try asking about your allocation, goals, savings rate, concentration, or insights.`;
}

function systemPrompt(s: FinancialSnapshot): string {
  return [
    "You are Orbis, an assistant that answers questions about the user's OWN financial data for the household '" + s.householdName + "'.",
    `All monetary amounts are in ${s.reportingCurrency}. Be concise, specific, and cite the actual numbers.`,
    "You are NOT a financial advisor. Provide general, informational observations only - never specific investment, tax, or legal advice. If the user asks for advice, frame it as general education and suggest consulting a professional.",
    "Answer ONLY from the JSON snapshot below. If something isn't in the snapshot, say you don't have that data.",
    "",
    "SNAPSHOT:",
    JSON.stringify(s),
  ].join("\n");
}

/** Calls an LLM provider if a key is configured; returns null if none/failed. */
export async function callLLM(messages: ChatMessage[], s: FinancialSnapshot): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const sys = systemPrompt(s);

  try {
    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          messages: [{ role: "system", content: sys }, ...messages],
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? null;
    }

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
          max_tokens: 700,
          system: sys,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.content?.[0]?.text ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function hasLLM(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}
