// Aunty Coach chat endpoint (Netlify Function) -> POST /api/aunty-coach
//
// The browser sends the chat history, this function adds Aunty's system prompt
// + Knowledge Base and asks Claude. The API key lives ONLY in Netlify's
// environment variables (ANTHROPIC_API_KEY) and never reaches the browser.
//
// Web version of ask_aunty() in aunty-coach/aunty_coach.py.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./knowledge.mjs";

const MODEL = process.env.AUNTY_MODEL || "claude-haiku-5-5";
const MAX_TOKENS = 1500;            // room for the model's thinking + a short reply

// Limits to keep the endpoint cheap and hard to abuse
const MAX_BODY_BYTES = 24_000;
const MAX_MESSAGES = 20;            // only the latest 20 turns are sent to Claude
const MAX_CHARS_PER_MESSAGE = 1000;

export const FALLBACK =
  "Aiyoh, good question! Aunty don't want to anyhow say. Please email hello@auntyapproved.sg " +
  "and the team will reply within 1 working day, okay?";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // reads ANTHROPIC_API_KEY from the environment; short timeout so we answer within Netlify's ~10s limit
  if (!client) client = new Anthropic({ timeout: 9000, maxRetries: 1 });
  return client;
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

// Only accept requests sent from this website (blocks other sites from using our key)
export function isAllowedOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;  // same-origin fetches from some browsers omit Origin; other limits still apply
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    if (o.host === self.host) return true;
    if (o.hostname === "localhost" || o.hostname === "127.0.0.1") return true;  // local testing
    const extra = (process.env.AUNTY_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    return extra.includes(o.origin);
  } catch {
    return false;
  }
}

// Returns a clean messages array, or null if the input is not acceptable.
export function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  let msgs = input.slice(-MAX_MESSAGES).map((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, MAX_CHARS_PER_MESSAGE);
    return content ? { role: m.role, content } : null;
  });
  if (msgs.some((m) => m === null)) return null;
  // the conversation must start with the customer, alternate, and end with the customer
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") return null;
  for (let i = 1; i < msgs.length; i++) if (msgs[i].role === msgs[i - 1].role) return null;
  return msgs;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "POST" });
  if (!isAllowedOrigin(req)) return json(403, { error: "forbidden" });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });

  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }); }
  const messages = cleanMessages(body && body.messages);
  if (!messages) return json(400, { error: "bad_messages" });

  const anthropic = getClient();
  if (!anthropic) {
    console.error("[aunty-coach] ANTHROPIC_API_KEY is not set in Netlify environment variables");
    return json(200, { reply: FALLBACK, offline: true });
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low" },   // quick, chatty answers
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (response.stop_reason === "refusal") return json(200, { reply: FALLBACK });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return json(200, { reply: reply || FALLBACK });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[aunty-coach] rate limited by Anthropic");
      return json(200, { reply: "Wah, many people asking Aunty right now! Try again in a minute, okay?" });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[aunty-coach] Anthropic API error", err.status, err.message);
    } else {
      console.error("[aunty-coach] unexpected error", err);
    }
    return json(200, { reply: FALLBACK });
  }
};

export const config = {
  path: "/api/aunty-coach",
  // Netlify rate limiting: max 15 messages per minute from one visitor
  rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
