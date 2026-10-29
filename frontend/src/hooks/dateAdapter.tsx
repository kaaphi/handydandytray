import dayjs, { Dayjs } from "dayjs";

/**
 * Converts specified string properties of T into Date objects
 */
export type WithDates<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: Dayjs;
};

export const transformDatesFromGo = <T extends Record<string, any>, K extends keyof T>(
  raw: T,
  dateKeys: K[]
): WithDates<T, K> => {
  const transformed = { ...raw } as any;
  for (const key of dateKeys) {
    if (transformed[key]) {
      transformed[key] = dayjs(transformed[key]);
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
    if (dayjs.isDayjs(value)) {
      raw[key] = value.toISOString();
    } else if (typeof value === 'string') {
      raw[key] = value; // Already an ISO string
    }
  }

  return raw;
}

export const transformDateToGo = (value: any): string => {
  if (dayjs.isDayjs(value)) {
    return value.toISOString()
  } else if (typeof value === 'string') {
    return value
  }
  return String(value)
}

export enum Day {
  Sunday = 0,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
}

/**
 * Returns the start of the most recent target day before the provided date.
 * 
 * @param targetDay the target day
 * @param date the date before which to find the target day
 * @param includeCurrentDay whether to include the provided date
 * @returns the start of the most recent target day before the provided date
 */
export const mostRecentDay = (targetDay: 0 | 1 | 2 | 3 | 4 | 5 | 6, date: Dayjs = dayjs(), includeCurrentDay: boolean = true):Dayjs => {
  // targetDay: 0=Sunday, 1=Monday, ..., 6=Saturday
  const diff = (date.day() - targetDay + 7) % 7;
  const daysBack = (diff === 0 && !includeCurrentDay) ? 7 : diff;
  return date.subtract(daysBack, "day").startOf("day");
}