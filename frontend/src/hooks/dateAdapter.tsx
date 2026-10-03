/**
 * Converts specified string properties of T into Date objects
 */
export type WithDates<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: Date;
};

export const transformDatesFromGo = <T extends Record<string, any>, K extends keyof T>(
  raw: T,
  dateKeys: K[]
): WithDates<T, K> => {
  const transformed = { ...raw } as any;
  for (const key of dateKeys) {
    if (transformed[key]) {
      transformed[key] = new Date(transformed[key]);
    }
  }
  return transformed;
}


export const transformDatesToGo = <T extends Record<string, any>, K extends keyof T>(
  data: T,
  dateKeys: K[]
): Omit<T, K> & Record<K, string> => {
  const raw = { ...data } as any;

  for (const key of dateKeys) {
    const value = raw[key];
    if (value instanceof Date) {
      raw[key] = value.toISOString();
    } else if (typeof value === 'string') {
      raw[key] = value; // Already an ISO string
    }
  }

  console.log(raw)

  return raw;
}