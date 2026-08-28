export function todayUtc(reference: Date = new Date()): string {
  return reference.toISOString().slice(0, 10);
}

export function isExpired(expiryDate: string, today: string = todayUtc()): boolean {
  return expiryDate < today;
}