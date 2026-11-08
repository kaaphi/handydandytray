import { UseMutateAsyncFunction, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Interval as RawInterval, IntervalStartBaselines as RawIntervalStartBaselines, TimeTrackingService, TimeTrackingStats } from "../../bindings/handydandytray/internal/timetracking";
import { transformDatesFromGo, transformDatesToGo, WithDates } from "./dateAdapter";
import { Events } from '@wailsio/runtime';
import { Dayjs } from "dayjs";
import dayjs from "../lib/dayjs";

export type Interval = WithDates<RawInterval, "Start" | "End">;
export type IntervalStartBaselines = WithDates<RawIntervalStartBaselines, "appStart" | "lastIntervalEnd" | "manual">

const convertIntervalToGo = (interval: Interval): RawInterval => {
    return transformDatesToGo(interval, ["Start", "End"])
}

export type UseTimetracking = {
    intervalStartBaselines?: IntervalStartBaselines
    recentActivities?: string[]|null
    addInterval: UseMutateAsyncFunction<void, Error, Interval, unknown>
    isLoading: boolean
    error: Error | null
}

export type UseTimetrackingStats = {
    data?: TimeTrackingStats|null
    isLoading: boolean
    error: Error | null
}

export const getInitalStartFromBaselines = (baselines?: IntervalStartBaselines): Dayjs => {
    if (!baselines) {
        return dayjs()
    }

    const mostRecentNonAppStart = [baselines.manual, baselines.lastIntervalEnd].filter(v => !!v).reduce<Dayjs|undefined>((current,next) => !current || next!.isAfter(current!) ? next : current, undefined)

    if (mostRecentNonAppStart?.isToday()) {
        return mostRecentNonAppStart
    } else if (mostRecentNonAppStart && baselines.appStart?.isToday()) {
        return baselines.appStart
    } else {
        return mostRecentNonAppStart ?? baselines.appStart ?? dayjs()
    }
}

export const useTimeTrackingStats = (start?: string, end?: string): UseTimetrackingStats => {
    const queryClient = useQueryClient();

    Events.On("timetracking:intervalAdded", () => {
        queryClient.invalidateQueries({queryKey: ["timetracking", "stats"]})
    })

    const stats = useQuery({
        queryKey: ["timetracking", "stats", start, end],
            queryFn: async () => {
                if (start && end) {
                    return TimeTrackingService.GetTimeTrackingDateStats(start, end)
                } else {
                    return null
                }
            },
            //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
            staleTime: Infinity
    })

    return {
        data: stats.data,
        error: stats.error,
        isLoading: stats.isPending
    }
}

export const useTimeTracking = (): UseTimetracking => {
    const queryClient = useQueryClient();

    Events.On("timetracking:baselineUpdated", () => {
        queryClient.invalidateQueries({queryKey: ["timetracking", "most recent end"]})
    })

    const intervalStartBaselines = useQuery({
            queryKey: ["timetracking", "most recent end"],
            queryFn: async () => {
                const rawBaselines = await TimeTrackingService.GetBaselineForNextInterval()

                return transformDatesFromGo(rawBaselines, ["appStart", "manual", "lastIntervalEnd"])
            },
            //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
            staleTime: Infinity
        })

    const recentActivities = useQuery({
        queryKey: ["timetracking", "recent activities"],
            queryFn: async () => TimeTrackingService.GetRecentActivities(14),
            //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
            staleTime: Infinity
    })

    const addIntervalMutation = useMutation({
        mutationFn: (interval: Interval) => TimeTrackingService.AddInterval(convertIntervalToGo(interval)),
        onSuccess: () => {
            Events.Emit("timetracking:intervalAdded")
            queryClient.invalidateQueries({ queryKey: ["timetracking"] });
        },
    })

    return {
        intervalStartBaselines: intervalStartBaselines.data,
        recentActivities: recentActivities.data,
        addInterval: addIntervalMutation.mutateAsync,
        isLoading: intervalStartBaselines.isPending || recentActivities.isPending,
        error: intervalStartBaselines.error,
    }
}