export const PAGE_SIZE = 20;

export function range(start: number, end: number): number[] {
  const len = end - start + 1;
  return Array.from({ length: len }, (_, i) => start + i);
}

export function buildPageItems(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return range(1, totalPages);
  if (current <= 4) return [...range(1, 5), "…", totalPages];
  if (current >= totalPages - 3) return [1, "…", ...range(totalPages - 4, totalPages)];
  return [1, "…", ...range(current - 1, current + 1), "…", totalPages];
}