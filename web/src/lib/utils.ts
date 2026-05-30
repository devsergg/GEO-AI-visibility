import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ENGINE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  google_serp: "Google AI Overview",
  perplexity: "Perplexity",
  gemini: "Gemini",
  google_ai_mode: "Google AI Mode",
};

export function engineLabel(engine: string): string {
  return ENGINE_LABELS[engine] ?? engine;
}

export const ALL_ENGINES = [
  "chatgpt",
  "google_serp",
  "perplexity",
  "gemini",
  "google_ai_mode",
];

export function scoreColor(score: number): string {
  if (score >= 80) return "#58a6ff";
  if (score >= 60) return "#3fb950";
  if (score >= 30) return "#e3b341";
  return "#f85149";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 30) return "Moderate";
  return "Low";
}

export function polarityColor(polarity: string): string {
  switch (polarity) {
    case "positive":
      return "#3fb950";
    case "negative":
      return "#f85149";
    case "mixed":
      return "#e3b341";
    default:
      return "#8b949e";
  }
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "#f85149";
    case "medium":
      return "#e3b341";
    default:
      return "#8b949e";
  }
}

export function formatRunId(runId: string): string {
  // run_20260530T064502_6bf970 → May 30, 06:45
  const match = runId.match(/run_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!match) return runId;
  const [, year, month, day, hour, min] = match;
  return `${month}/${day}/${year} ${hour}:${min}`;
}
