import dayjs, { Dayjs } from "dayjs"
import { RelativeTime } from "./dayjs"
import { Text, TextProps } from "@mantine/core"
import { InfoIcon, WarningIcon } from "@phosphor-icons/react"

type DateOrTimeValueProps = {
    time : Dayjs,
    format : string,
}

const DateOrTimeValue = ({time, format}: DateOrTimeValueProps) => {
    if (format === 'relativeTime') {
        return <RelativeTime time={time} />
    } else if (format === "relativeDate") {
        return <RelativeTime time={time} resolution="day" />
    } else if (format === "date") {
        return time.format("YYYY-MM-DD")
    } else {
        return time.format(format)
    }
}

type ConditionalDateTimeStyle = {
    symbol? : React.ReactNode,
    textStyle? : TextProps
}

const ConditionalDateTimeStyleTypes : Record<string, ConditionalDateTimeStyle> = {
    none: {
        textStyle: {c: "dimmed"},
    },
    info: {
        symbol: <InfoIcon />,
        textStyle: {c: "dimmed"},
    },
    dueToday: {
        symbol: <InfoIcon />,
        textStyle: {c: "dimmed", fw: 500 },
    },
    mildOverdue: {
        symbol: <WarningIcon />,
        textStyle: {c: "yellow", fw: 500},
    },
    overdue: {
        symbol: <WarningIcon />,
        textStyle: {c: "red", fw: 500},
    },
}

export type WarnType = {
    styleChooser: (time: Dayjs) => ConditionalDateTimeStyle,
    isOverdue: (time: Dayjs) => boolean,
}

export const WarnTypes: Record<string, WarnType> = {
    none: {
        styleChooser: () => ConditionalDateTimeStyleTypes.none,
        isOverdue: () => false,
    },
    dueOnDate: {
        styleChooser: (time) => {
            const now = dayjs()
            if (time.isToday()) {
                return ConditionalDateTimeStyleTypes.dueToday
            } else if (now.isAfter(time)) {
                return ConditionalDateTimeStyleTypes.overdue
            } else {
                return ConditionalDateTimeStyleTypes.info
            }
        },
        isOverdue: (time) => dayjs().isAfter(time.add(1, "day"))
    },
    dueAtTime: {
        styleChooser: (time) => {
            if (dayjs().isAfter(time)) {
                return time.isToday() ? ConditionalDateTimeStyleTypes.mildOverdue : ConditionalDateTimeStyleTypes.overdue
            } else {
                return ConditionalDateTimeStyleTypes.info
            }
        },
        isOverdue: (time) => dayjs().isAfter(time),
    },
}

type ConditionalDateTimeProps = {
    time? : Dayjs|string,
    label : string,
    overdueLabel? : string,
    format : string,
    warningType? : WarnType
}

export const TodoDateTime = ({time, label, overdueLabel, format, warningType = WarnTypes.none} : ConditionalDateTimeProps) => {
    if (time === undefined) {
        return null
    }
    if (typeof time === 'string') {
        time = dayjs(time)
    }


    const finalLabel = (warningType.isOverdue(time) && overdueLabel) ? overdueLabel : label
    const style = warningType.styleChooser(time)

    return <Text style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '.25em',
      }} {...style.textStyle} size="xs">{ style.symbol && <>{style.symbol} </>}{finalLabel} <DateOrTimeValue time={time} format={format} /></Text>
}