import Groq from "groq-sdk";
import { env } from "@/lib/env";

let client: Groq | null = null;
function groq(): Groq {
  if (!client) client = new Groq({ apiKey: env.groqApiKey() });
  return client;
}

export function aiEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}

type ChatOptions = {
  system?: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
};

export async function chat(opts: ChatOptions): Promise<string> {
  if (!aiEnabled()) throw new Error("Groq AI is not configured. Set GROQ_API_KEY.");
  const res = await groq().chat.completions.create({
    model: env.groqModel(),
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 800,
    response_format: opts.json ? { type: "json_object" } : undefined,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user", content: opts.user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function chatJson<T>(opts: ChatOptions): Promise<T> {
  const raw = await chat({ ...opts, json: true });
  return JSON.parse(raw) as T;
}
