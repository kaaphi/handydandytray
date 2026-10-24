import dayjs, { Dayjs } from 'dayjs';

import weekday from 'dayjs/plugin/weekday';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import isYesterday from 'dayjs/plugin/isYesterday';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration'
import { Tooltip } from '@mantine/core';
import { useTick } from '../hooks/useTicker';

dayjs.extend(weekday)
dayjs.extend(isToday)
dayjs.extend(isTomorrow)
dayjs.extend(isYesterday)
dayjs.extend(relativeTime)
dayjs.extend(duration)
dayjs.extend

export default dayjs

type RelativeTimeResolution = "time" | "day"

const formatRelativeTime = (time: Dayjs, resolution: RelativeTimeResolution): string => {
    switch (resolution) {
        case "time": return time.fromNow()
        case "day": if (time.isToday()) {
            return "Today"
        } else if (time.isTomorrow()) {
            return "Tomorrow"
        } else if (time.isYesterday()) {
            return "Yesterday"
        } else {
            return time.fromNow()
        }
        default:
            throw new Error(`Invalid resolution: ${resolution}!`)
    }
}

export const RelativeTime = ({time, resolution = "time"} : {time : Dayjs, resolution? : RelativeTimeResolution}) => {
    useTick()
    
    const format = resolution === "day" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm"

    return <Tooltip label={time.format(format)}>
        <span>{formatRelativeTime(time, resolution)}</span>
    </Tooltip>    
}

export type TimeRange = {
    start: Dayjs,
    end: Dayjs,
}