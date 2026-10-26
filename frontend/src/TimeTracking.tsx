import { Divider, Group, MantineStyleProp, Stack, Table, Title } from "@mantine/core";
import { DatePickerInput, DatesRangeValue } from "@mantine/dates";
import dayjs from "dayjs";
import React, { useState } from "react";
import { useTimeTrackingStats } from "./hooks/useTimeTracking";
import { transformDateToGo } from "./hooks/dateAdapter";
import { DateStats } from "../bindings/handydandytray/internal/timetracking";

type ActivitiesType = {
 [x: string]: number | undefined;
} | null | undefined

const dateStringToGo = (value?: string | Date | null, roundUpToNextDay?: boolean): string | undefined => {
    if (value) {
        return transformDateToGo(roundUpToNextDay ? dayjs(value).startOf("day").add(1, "day") : dayjs(value))
    } else {
        return undefined
    }
}

const defaultDateRange = (): [string, string] => {
    const startOfWeek = dayjs().startOf("week")
    if (startOfWeek.isToday()) {
        return [startOfWeek.add(-1, "week").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    } else {
        return [startOfWeek.format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    }
}

const calcDateStatsTotalDuration = (dateStats?: DateStats): number => {
    if (!dateStats) {
        return 0
    }

    return Object.entries(dateStats.Activities!).
        map(([_, activities]) => calcActivitiesTotalDuration(activities))
        .reduce((acc, current) => (acc || 0) + (current || 0), 0) || 0
}

const calcActivitiesTotalDuration = (activities?: ActivitiesType): number => {
    if (!activities) {
        return 0
    }

    return Object.values(activities!).
            reduce((acc, current) => (acc || 0) + (current || 0), 0) || 0
}

export const TimeTracking = () => {
    const [dateRange, setDateRange] = useState<DatesRangeValue>(defaultDateRange());

    const stats = useTimeTrackingStats(dateStringToGo(dateRange[0]), dateStringToGo(dateRange[1], true))

    const totalDuration = stats.data?.
        map(calcDateStatsTotalDuration)
        .reduce((acc, current) => (acc || 0) + (current || 0), 0) || 0

    return (
        <Stack>
            <Group><DatePickerInput
                type="range"
                label="Date range"
                placeholder="Date range"
                value={dateRange}
                onChange={setDateRange}
            /></Group>
            <Title order={5}>Total Duration: {Math.floor(totalDuration / 60).toString().padStart(2, "0")}:{(totalDuration % 60).toString().padStart(2, "0")}</Title>
            {stats.data?.map((dateStats, dateIndex) => <React.Fragment key={dateStats.Date}>
                {!(dateIndex == 0) && <Divider variant="dashed" size="md" />}
                <Table tabularNums withRowBorders stickyHeader>
                    <Table.Thead>
                        <Table.Th>{dayjs(dateStats.Date!).format("dddd YYYY-MM-DD")}</Table.Th>
                        <Table.Th>{dayjs.duration(calcDateStatsTotalDuration(dateStats), "minutes").format("HH:mm")}</Table.Th>
                    </Table.Thead>
                    <Table.Tbody>
                        {Object.entries(dateStats.Activities!).map(([category, activities], categoryIndex) => 
                            <React.Fragment key={`category-${category}`}>
                                <Table.Tr fw={500}>
                                    <Table.Td>{category}</Table.Td>
                                    <Table.Td>{dayjs.duration(calcActivitiesTotalDuration(activities), "minutes").format("HH:mm")}</Table.Td>
                                </Table.Tr>
                            {Object.entries(activities!).map(([activity, duration], activityIndex) => {
                                return <Table.Tr key={`${dateStats.Date}-${categoryIndex}-${activity}`} >
                                    <Table.Td pl="3em">{activity}</Table.Td>
                                    <Table.Td>{dayjs.duration(duration || 0, "minutes").format("HH:mm")}</Table.Td>
                                </Table.Tr>
                            })}
                            </React.Fragment>)
                        }
                    </Table.Tbody>
                </Table>
            </React.Fragment>)
            }
       </Stack>
    )
}