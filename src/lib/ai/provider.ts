import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type Provider = "openai" | "google" | "anthropic";

const DEFAULT_MODEL: Record<Provider, string> = {
  openai: "gpt-4.1-mini",
  google: "gemini-2.5-flash",
  anthropic: "claude-haiku-4-5-20251001",
};

const KEY_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** The configured provider, or null when AI is switched off (no key set). */
export function activeProvider(): Provider | null {
  const wanted = (process.env.AI_PROVIDER || "").toLowerCase() as Provider;
  if (wanted in KEY_ENV) return process.env[KEY_ENV[wanted]] ? wanted : null;
  return (Object.keys(KEY_ENV) as Provider[]).find((p) => process.env[KEY_ENV[p]]) ?? null;
}

export function getModel(): LanguageModel | null {
  const p = activeProvider();
  if (!p) return null;
  const id = process.env.AI_MODEL || DEFAULT_MODEL[p];
  if (p === "openai") return openai(id);
  if (p === "google") return google(id);
  return anthropic(id);
}
