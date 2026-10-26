import { UseMutateAsyncFunction, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateStats, Interval as RawInterval, TimeTrackingService } from "../../bindings/handydandytray/internal/timetracking";
import dayjs, { Dayjs } from "dayjs";
import { transformDatesToGo, WithDates } from "./dateAdapter";

export type Interval = WithDates<RawInterval, "Start" | "End">;

const convertIntervalToGo = (interval: Interval): RawInterval => {
    return transformDatesToGo(interval, ["Start", "End"])
}

export type UseTimetracking = {
    latestIntervalEnd?: Dayjs
    recentActivities?: string[]|null
    addInterval: UseMutateAsyncFunction<void, Error, Interval, unknown>
    isLoading: boolean
    error: Error | null
}

export type UseTimetrackingStats = {
    data?: DateStats[]|null
    isLoading: boolean
    error: Error | null
}


export const useTimeTrackingStats = (start?: string, end?: string): UseTimetrackingStats => {
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

    const latestIntervalEnd = useQuery({
            queryKey: ["timetracking", "most recent end"],
            queryFn: async () => {
                const rawString = await TimeTrackingService.GetBaselineForNextInterval()

                return dayjs(rawString)
            },
            //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
            staleTime: Infinity
        })

    const recentActivities = useQuery({
        queryKey: ["timetracking", "recent activities"],
            queryFn: async () => TimeTrackingService.GetRecentActivities(7),
            //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
            staleTime: Infinity
    })

    const addIntervalMutation = useMutation({
        mutationFn: (interval: Interval) => TimeTrackingService.AddInterval(convertIntervalToGo(interval)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["timetracking"] });
        },
    })

    return {
        latestIntervalEnd: latestIntervalEnd.data,
        recentActivities: recentActivities.data,
        addInterval: addIntervalMutation.mutateAsync,
        isLoading: latestIntervalEnd.isPending || recentActivities.isPending,
        error: latestIntervalEnd.error,
    }
}