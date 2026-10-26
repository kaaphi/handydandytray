import { Group, Stack, Table, Title } from "@mantine/core";
import { DatePickerInput, DatesRangeValue } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";
import { useTimeTrackingStats } from "./hooks/useTimeTracking";
import { transformDateToGo } from "./hooks/dateAdapter";

const dateStringToGo = (value?: string|Date|null, roundUpToNextDay?: boolean): string|undefined => {
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

export const TimeTracking = () => {
    const [dateRange, setDateRange] = useState<DatesRangeValue>(defaultDateRange());

    const stats = useTimeTrackingStats(dateStringToGo(dateRange[0]), dateStringToGo(dateRange[1], true))

    const totalDuration = stats.data?.
        map((dateStats) => Object.entries(dateStats.Activities!).
            map(([_, activities]) => Object.values(activities!).
                reduce((acc, current) => (acc || 0) + (current || 0), 0))
                .reduce((acc, current) => (acc || 0) + (current || 0), 0)                
            )
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
            <Title order={5}>Total Duration: {Math.floor(totalDuration/60).toString().padStart(2,"0")}:{(totalDuration%60).toString().padStart(2,"0")}</Title>
            <Table tabularNums withRowBorders={false} withColumnBorders stickyHeader>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Day</Table.Th>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Category</Table.Th>
                        <Table.Th>Activity</Table.Th>
                        <Table.Th>Duration</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {stats.data?.map((dateStats, dateIndex) => 
                        Object.entries(dateStats.Activities!).map(([category, activities], categoryIndex) => 
                            Object.entries(activities!).map(([activity, duration], activityIndex) => {
                            const dateRow = categoryIndex == 0 && activityIndex == 0
                            const categoryRow = activityIndex == 0
                            
                            return <Table.Tr key={`${dateStats.Date}-${categoryIndex}-${activity}`} style={dateRow ? {borderTop: "1px solid var(--mantine-color-gray-3)"} : {}} >
                                <Table.Td>{dateRow ? dayjs(dateStats.Date!).format("ddd") : ""}</Table.Td>
                                <Table.Td>{dateRow ? dateStats.Date : ""}</Table.Td>
                                <Table.Td style={categoryRow ? {borderTop: "1px solid var(--mantine-color-gray-3)"} : {}}>{categoryRow ? category : ""}</Table.Td>
                                <Table.Td style={{borderTop: "1px solid var(--mantine-color-gray-3)"}}>{activity}</Table.Td>
                                <Table.Td style={{borderTop: "1px solid var(--mantine-color-gray-3)"}}>{dayjs.duration(duration || 0, "minutes").format("HH:mm")}</Table.Td>
                            </Table.Tr>
                            })
                        )
                    )}
                </Table.Tbody>
            </Table>
        </Stack>
    )
}