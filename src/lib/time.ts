export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

export const toIsoOrNull = (date: Date | null) => (date ? date.toISOString() : null);
