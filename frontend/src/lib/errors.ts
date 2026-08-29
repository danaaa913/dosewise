import type { Translations } from "@/i18n/translations";

export function getErrorMessage(
  t: Translations,
  error: unknown,
  fallback: string,
  networkMessage?: string
): string {
  const code = (error as { code?: string })?.code;
  if (code && code in t.errorCodes) return t.errorCodes[code as keyof typeof t.errorCodes];
  const message = error instanceof Error ? error.message : "";
  if (networkMessage && /failed to fetch|network/i.test(message)) return networkMessage;
  return fallback;
}