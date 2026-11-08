import { expect, it } from "vitest";
import { getInitalStartFromBaselines, IntervalStartBaselines } from "./useTimeTracking";
import { vi } from "vitest";
import dayjs from "../lib/dayjs";


type IntervalStartBaselineCase = {
    name: string
    baselines?: IntervalStartBaselines
    expected: keyof IntervalStartBaselines | "now"
}

const now = dayjs("2026-01-02T12:00:00Z")

it.for([
    {
        name: "empty",
        baselines: {},
        expected: "now",
    },
    {
        name: "only app start today",
        baselines: {
            appStart: dayjs("2026-01-02T10:00:00Z")
        },
        expected: "appStart",
    },
    {
        name: "only app start yesterday",
        baselines: {
            appStart: dayjs("2026-01-01T10:00:00Z")
        },
        expected: "appStart",
    },
    {
        name: "app start today < manual today",
        baselines: {
            appStart: dayjs("2026-01-02T09:00:00Z"),
            manual: dayjs("2026-01-02T10:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "app start yesterday < manual yesterday",
        baselines: {
            appStart: dayjs("2026-01-01T09:00:00Z"),
            manual: dayjs("2026-01-01T10:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "app start yesterday < manual today",
        baselines: {
            appStart: dayjs("2026-01-01T12:00:00Z"),
            manual: dayjs("2026-01-02T10:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "app start yesterday < manual today < lastIntervalEnd today",
        baselines: {
            appStart: dayjs("2026-01-01T12:00:00Z"),
            manual: dayjs("2026-01-02T10:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-02T11:00:00Z")
        },
        expected: "lastIntervalEnd",
    },
    {
        name: "app start yesterday < manual yesterday < lastIntervalEnd today",
        baselines: {
            appStart: dayjs("2026-01-01T10:00:00Z"),
            manual: dayjs("2026-01-01T12:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-02T11:00:00Z")
        },
        expected: "lastIntervalEnd",
    },
    {
        name: "app start yesterday < manual yesterday < lastIntervalEnd yesterday",
        baselines: {
            appStart: dayjs("2026-01-01T10:00:00Z"),
            manual: dayjs("2026-01-01T12:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-01T14:00:00Z")
        },
        expected: "lastIntervalEnd",
    },
    {
        name: "lastIntervalEnd yesterday < app start yesterday < manual yesterday",
        baselines: {
            appStart: dayjs("2026-01-01T10:00:00Z"),
            manual: dayjs("2026-01-01T12:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-01T08:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "lastIntervalEnd yesterday < app start today < manual today",
        baselines: {
            appStart: dayjs("2026-01-02T10:00:00Z"),
            manual: dayjs("2026-01-02T12:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-01T08:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "app start today < lastIntervalEnd today < manual today",
        baselines: {
            appStart: dayjs("2026-01-02T08:00:00Z"),
            manual: dayjs("2026-01-02T11:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-02T10:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "lastIntervalEnd today < manual today < app start today",
        baselines: {
            appStart: dayjs("2026-01-02T11:30:00Z"),
            manual: dayjs("2026-01-02T11:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-02T10:00:00Z")
        },
        expected: "manual",
    },
    {
        name: "manual today < lastIntervalEnd today < app start today",
        baselines: {
            appStart: dayjs("2026-01-02T11:30:00Z"),
            manual: dayjs("2026-01-02T10:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-02T11:00:00Z")
        },
        expected: "lastIntervalEnd",
    },
    {
        name: "manual yesterday < lastIntervalEnd yesterday < app start today",
        baselines: {
            appStart: dayjs("2026-01-02T11:30:00Z"),
            manual: dayjs("2026-01-01T10:00:00Z"),
            lastIntervalEnd: dayjs("2026-01-01T11:00:00Z")
        },
        expected: "appStart",
    },
] as IntervalStartBaselineCase[])("getInitalStartFromBaselines $name", ({ baselines, expected: expectedProp }) => {
    vi.setSystemTime(now.toDate())

    const expected = expectedProp === "now" ? now : baselines![expectedProp]
    const actual = getInitalStartFromBaselines(baselines)
    const actualProp = Object.entries(baselines ?? {}).find(([_, value]) => value.isSame(actual))?.[0] ?? actual.toISOString()

    expect(actual, `Expected ${expectedProp}, but was ${actualProp}!`).toStrictEqual(expected)
})