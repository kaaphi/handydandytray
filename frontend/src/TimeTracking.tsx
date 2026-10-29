import { ColorSwatch, DataList, DataListItem, DataListItemLabel, DataListItemValue, Group, ScrollArea, SimpleGrid, Stack, Table, Tabs, Title } from "@mantine/core";
import { DonutChart, DonutChartCell, DonutChartProps, SankeyChart, SankeyChartData, SankeyChartProps } from '@mantine/charts';
import { DatePickerInput, DatesRangeValue } from "@mantine/dates";
import dayjs from "dayjs";
import React, { useState } from "react";
import { useTimeTrackingStats } from "./hooks/useTimeTracking";
import { Day, mostRecentDay, transformDateToGo } from "./hooks/dateAdapter";
import { Category, TimeTrackingStats } from "../bindings/handydandytray/internal/timetracking";
import { ChartHueTuple, chartPaletteHue, chartHueColor } from "./lib/theme";
import { ErrorBoundary } from "react-error-boundary";
import { FallbackError } from "./FallbackError";

const dateStringToGo = (value?: string | Date | null, roundUpToNextDay?: boolean): string | undefined => {
    if (value) {
        return transformDateToGo(roundUpToNextDay ? dayjs(value).startOf("day").add(1, "day") : dayjs(value))
    } else {
        return undefined
    }
}

const defaultDateRange = (): [string, string] => {
    const startOfWeek = mostRecentDay(Day.Monday)
    if (startOfWeek.isToday()) {
        return [startOfWeek.add(-1, "week").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    } else {
        return [startOfWeek.format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    }
}

const formatDuration = (minutes?: number): string =>
    minutes ? `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}` : "00:00"



type DataStatsTableRowProps = {
    label: string,
    value: string,
}

const H1Row = ({ label, value }: DataStatsTableRowProps) => (
    <Table.Tr fw={700} style={{ borderBottom: "0px" }}>
        <Table.Td pt="lg">{label}</Table.Td>
        <Table.Td pt="lg" align="right">{value}</Table.Td>
        <Table.Td miw="80" />
    </Table.Tr>
)
const H2Row = ({ label, value }: DataStatsTableRowProps) => (
    <Table.Tr fw={500}>
        <Table.Td pt="lg">{label}</Table.Td>
        <Table.Td pt="lg" align="right">{value}</Table.Td>
        <Table.Td />
    </Table.Tr>
)
type DataStatsTableDataRowProps = {
    lastForSection: boolean
} & DataStatsTableRowProps
const DataRow = ({ label, value, lastForSection }: DataStatsTableDataRowProps) => (
    <Table.Tr style={lastForSection ? { borderBottomWidth: "4px", borderBottomStyle: "double" } : {}}>
        <Table.Td pl="3em" pb={lastForSection ? "lg" : undefined}>{label}</Table.Td>
        <Table.Td pb={lastForSection ? "lg" : undefined} align="right">{value}</Table.Td>
        <Table.Td />
    </Table.Tr>
)

type DateStatsTableProps = {
    stats: TimeTrackingStats,
    reverseOrder?: boolean,
    withTotalsSection?: boolean
}
const DateStatsTable = ({ stats, reverseOrder = false, withTotalsSection = false }: DateStatsTableProps) => {

    return (
        <Table tabularNums withRowBorders horizontalSpacing="lg">
            <Table.Tbody>
                {withTotalsSection && <>
                    <H1Row label="Total" value={formatDuration(stats.TotalDurationMinutes)} />
                    {stats.TotalsByCategory?.map((category, categoryIdx, categoryArray) => (
                        <React.Fragment key={`category-${category.Name}`}>
                            <H2Row label={category.Name} value={formatDuration(category.TotalDurationMinutes)} />
                            {category.Activities?.map((activity, activityIdx, activityArray) => (
                                <React.Fragment key={`activity-${activity.Name}`}>
                                    <DataRow label={activity.Name} value={formatPercentDisplay(activity.DurationMinutes, category.TotalDurationMinutes)} lastForSection={categoryIdx == categoryArray.length - 1 && activityIdx == activityArray.length - 1} />
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                </>}
                {stats.Dates!.map((item, dateIndex, array) => {
                    const dateStats = reverseOrder ? array[array.length - 1 - dateIndex] : item
                    const lastDay = dateIndex == array.length - 1
                    return <React.Fragment key={dateStats.Date}>
                        <H1Row label={dayjs(dateStats.Date!).format("dddd YYYY/MM/DD")} value={formatDuration(dateStats.TotalDurationMinutes)} />
                        {dateStats.Categories!.map((category, categoryIndex, array) => {
                            const lastCategory = categoryIndex == array.length - 1
                            return <React.Fragment key={`category-${category.Name}`}>
                                <H2Row label={category.Name} value={formatDuration(category.TotalDurationMinutes)} />
                                {category.Activities!.map((activity, activityIndex, array) => {
                                    const lastActivity = activityIndex == array.length - 1
                                    const lastForDay = lastCategory && lastActivity && !lastDay
                                    return <React.Fragment key={`${dateStats.Date}-${categoryIndex}-${activity.Name}`}>
                                        <DataRow label={activity.Name} value={formatDuration(activity.DurationMinutes)} lastForSection={lastForDay} />
                                    </React.Fragment>
                                })}
                            </React.Fragment>
                        })
                        }
                    </React.Fragment>
                })
                }
            </Table.Tbody>
        </Table>
    )
}

const TimeTrackingHistory = () => {
    const [dateRange, setDateRange] = useState<DatesRangeValue>(defaultDateRange());

    const stats = useTimeTrackingStats(dateStringToGo(dateRange[0]), dateStringToGo(dateRange[1], true))


    return (
        <Stack>
            <Group><DatePickerInput
                type="range"
                label="Date range"
                placeholder="Date range"
                value={dateRange}
                onChange={setDateRange}
                valueFormat="YYYY/MM/DD"
            /></Group>
            <Title order={5}>Total Duration: {formatDuration(stats.data?.TotalDurationMinutes)}</Title>
            <TimeTrackingSankey timeTrackingData={stats.data} valueFormatType="percent" pr="md" />
            {stats.data && <DateStatsTable stats={stats.data!} withTotalsSection />}
        </Stack>
    )
}

type TimeTrackingFormatterTypes = "duration" | "percent"

type TimeTrackingChartProps = {
    timeTrackingData?: TimeTrackingStats | null
    valueFormatType?: TimeTrackingFormatterTypes
}


const formatPercentDisplay = (value: number, total: number): string => {
    const percent = Math.round(100 * value / (total))
    if (percent === 0) {
        return "<1%"
    } else {
        return `${percent}%`
    }
}

const chartValueFormatter = (type: TimeTrackingFormatterTypes, total: number): ((value: number) => string) => {
    switch (type) {
        case "duration":
            return formatDuration
        case "percent":
            return (value) => formatPercentDisplay(value, total)
    }
}

const TimeTrackingSankey = ({ timeTrackingData, valueFormatType = "duration", ...props }: TimeTrackingChartProps & Partial<SankeyChartProps>) => {
    
    const sankeyData: SankeyChartData = {
        nodes: [{ name: "total", color: "gray.6" }],
        links: []
    }

    let nodeIndex = 1
    timeTrackingData?.TotalsByCategory?.forEach((category, idx, array) => {
        const categoryNodeIndex = nodeIndex++
        const categoryHue = chartPaletteHue(idx, array.length)
        sankeyData.nodes.push({ name: category.Name, color: categoryHue[0] })
        sankeyData.links.push({ source: 0, target: categoryNodeIndex, value: category.TotalDurationMinutes })
        const sortedActivities = [...category.Activities!].sort((a, b) => b.DurationMinutes - a.DurationMinutes)

        sortedActivities.forEach((activity, idx, array) => {
            sankeyData.nodes.push({ name: activity.Name, color: chartHueColor(categoryHue, idx, array.length) })
            sankeyData.links.push({ source: categoryNodeIndex, target: nodeIndex++, value: activity.DurationMinutes })
        })
    })

    return <SankeyChart data={sankeyData} valueFormatter={chartValueFormatter(valueFormatType, timeTrackingData?.TotalDurationMinutes ?? 0)} {...props} />
}


type CategoryDonutProps = {
    category: Category
    baseColor: ChartHueTuple
} & Partial<TimetrackingBreakdownChartProps>
const CategoryDonut = ({ category, baseColor, ...props }: CategoryDonutProps) => {
    const sortedActivities = [...category.Activities!].sort((a, b) => b.DurationMinutes - a.DurationMinutes)

    const chartData: DonutChartCell[] = sortedActivities.map((activity, idx, array) => ({
        name: `${activity.Name}`,
        value: activity.DurationMinutes,
        color: chartHueColor(baseColor, idx, array.length),
    }))

    console.log(category.Name, chartData)

    return <TimetrackingBreakdownChart data={chartData} chartLabel={category.Name} {...props} />
}

type TimetrackingBreakdownChartProps = DonutChartProps
const TimetrackingBreakdownChart = ({ ...props }: TimetrackingBreakdownChartProps) => {
    const total = props.data.reduce((sum, item) => sum + item.value, 0)
    return (<Stack gap="xs" w={props.size ? props.size * 1.2 : undefined} align="center">
        <DonutChart {...props} tooltipDataSource="segment" tooltipProps={{
            wrapperStyle: { zIndex: 1000 },
        }} valueFormatter={chartValueFormatter("duration", total)} thickness={25} fw={500} />
        <Table withRowBorders={false} horizontalSpacing="xs" verticalSpacing={1}>
            <Table.Tbody>
                {props.data.map((item) => <Table.Tr key={item.name}>
                    <Table.Td><ColorSwatch size={15} color={item.color} /></Table.Td>
                    <Table.Td>{item.name}</Table.Td>
                    <Table.Td align="right">{formatPercentDisplay(item.value, total)}</Table.Td>
                </Table.Tr>)}

            </Table.Tbody>
        </Table>
    </Stack>
    )
}

const Today = () => {
    const dateRange = defaultDateRange()
    const stats = useTimeTrackingStats(dateStringToGo(dateRange[0]), dateStringToGo(dateRange[1], true))

    console.log("Totals by category", stats.data?.TotalsByCategory)

    const chartData: DonutChartCell[] = (stats.data?.TotalsByCategory ?? []).map((category, idx, array) => (
        {
            name: category.Name,
            value: category.TotalDurationMinutes,
            color: chartPaletteHue(idx, array.length)[0]
        })
    )

    const lastStats = stats.data?.Dates![stats.data?.Dates!.length - 1]
    const todayStats = dayjs(lastStats?.Date).isToday() ? lastStats : undefined

    return (
        <Stack gap="sm" pt="md" pb="md">
            <SimpleGrid minColWidth={200} >
                <DataList size="xl" fw={700} p="lg">
                    <DataListItem>
                        <DataListItemLabel>Total</DataListItemLabel>
                        <DataListItemValue>{formatDuration(stats.data?.TotalDurationMinutes)}</DataListItemValue>
                    </DataListItem>
                    <DataListItem>
                        <DataListItemLabel>Today</DataListItemLabel>
                        <DataListItemValue>{formatDuration(todayStats?.TotalDurationMinutes)}</DataListItemValue>
                    </DataListItem>
                </DataList>
                <TimetrackingBreakdownChart data={chartData} chartLabel="categories" size={150} />
                {stats.data?.TotalsByCategory?.map((category, idx, array) => (
                    <CategoryDonut category={category} baseColor={chartPaletteHue(idx, array.length)} size={150} />
                ))}
            </SimpleGrid>

            {stats.data && <DateStatsTable stats={stats.data} reverseOrder />}
        </Stack>
    )
}

export const TimeTracking = () => {
    return (
        <ErrorBoundary fallback={<FallbackError />}>
            <Tabs keepMounted={false} defaultValue="today" h="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
                <Tabs.List style={{ flexShrink: 0 }}>
                    <Tabs.Tab value="today">Today</Tabs.Tab>
                    <Tabs.Tab value="history">History</Tabs.Tab>
                </Tabs.List>


                <Tabs.Panel value="today" style={{ flex: 1, minHeight: 0 }}>
                    <ScrollArea h="100%">
                        <Today />
                    </ScrollArea>
                </Tabs.Panel>
                <Tabs.Panel value="history" style={{ flex: 1, minHeight: 0 }}><Table.ScrollContainer h="100%" minWidth={0}><TimeTrackingHistory /></Table.ScrollContainer></Tabs.Panel>
            </Tabs>
        </ErrorBoundary>
    )
}