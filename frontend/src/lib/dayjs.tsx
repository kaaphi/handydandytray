import dayjs, { Dayjs } from 'dayjs';

import weekday from 'dayjs/plugin/weekday';
import isToday from 'dayjs/plugin/isToday';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Tooltip } from '@mantine/core';
import { useEffect, useState } from 'react';

dayjs.extend(weekday);
dayjs.extend(isToday);
dayjs.extend(relativeTime)

export default dayjs

const getOptimalInterval = (date: Dayjs): number => {
  const diffInMinutes = Math.abs(dayjs().diff(dayjs(date), "minute"));

  if (diffInMinutes < 1) return 10000;    // Under 1 min: update every 10 seconds
  if (diffInMinutes < 60) return 60000;   // Under 1 hour: update every 1 minute
  return 3600000;                         // 1+ hours: update every 1 hour
}

export const RelativeTime = ({time} : {time : Dayjs}) => {
    const [relativeText, setRelativeText] = useState(() => time.fromNow());

    useEffect(() => {
        function update() {
            setRelativeText(time.fromNow());
        }

        update();
        const intervalMs = getOptimalInterval(time);
        const timer = setInterval(update, intervalMs);

        return () => clearInterval(timer);
    }, [time]);

    return <Tooltip label={time.format("YYYY-MM-DD HH:mm")}>
        <span>{relativeText}</span>
    </Tooltip>    
}