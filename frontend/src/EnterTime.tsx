import { ActionIcon, Autocomplete, Button, Group, keys, LoadingOverlay, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { formRootRule, useForm } from "@mantine/form";
import { randomId } from "@mantine/hooks";
import { ArrowsClockwiseIcon, ClockClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useState, type ReactNode } from "react";
import { Events } from '@wailsio/runtime';
import { DateTimePicker, DateTimePickerProps } from "@mantine/dates";
import { useTimeTracking } from "./hooks/useTimeTracking";
import { UIService } from "../bindings/handydandytray/internal/ui";

type FormValue = {
    entries: EntryFormValue[],
    intervalStart: string
    intervalEnd: string
}

type TransformedFormValue = {
    entries: TransformedEntryFormValue[],
    remainingIntervalMinutes: number
    intervalStart: Dayjs
    intervalEnd: Dayjs
}

type EntryFormValue = {
    activity: string,
    duration: string,
    key: string,
}

type TransformedEntryFormValue = {
    activity: string,
    duration: number | null,
}

const formatDuration = (minutes: number | null): string | null => {
    return minutes != null ? dayjs.duration(minutes, "minutes").format("HH:mm") : null
}

const validateDuration = (value: string, values: { entries: EntryFormValue[] }): string | null => {
    if (value === "r") {
        if (values.entries.filter(e => e.duration === "r").length > 1) {
            return "Only one rest of duration allowed!"
        } else {
            return null
        }
    } if (/^\d+%?$/.test(value)) {
        return null
    }
    return "Invalid duration!"
}

const calculateDurations = (formValue: FormValue): TransformedFormValue => {
    const intervalStart = dayjs(formValue.intervalStart)
    const intervalEnd = dayjs(formValue.intervalEnd)
    let remainingIntervalMinutes = intervalEnd.diff(intervalStart, "minutes")

    //create initial pairs populated with absolute numbers
    const transformPairs: [EntryFormValue, TransformedEntryFormValue][] = formValue.entries.map(e => {
        const durationAsNumber = Number(e.duration)
        if (!Number.isNaN(durationAsNumber) && Number.isInteger(durationAsNumber) && String(durationAsNumber) === e.duration) {
            remainingIntervalMinutes -= durationAsNumber
            return [e, { activity: e.activity, duration: durationAsNumber }]
        } else {
            return [e, { activity: e.activity, duration: null }]
        }
    })

    if (remainingIntervalMinutes > 0) {
        //handle percentages
        const minutesToTakePercentFrom = remainingIntervalMinutes
        for (const [entry, transformed] of transformPairs) {
            if (transformed.duration == null && /^\d+%$/.test(entry.duration)) {
                const percent = parseInt(entry.duration)
                transformed.duration = (minutesToTakePercentFrom * percent) / 100
                remainingIntervalMinutes -= transformed.duration
            }
        }

        //handle the rest
        for (const [entry, transformed] of transformPairs) {
            if (transformed.duration == null) {
                if (entry.duration === "r") {
                    transformed.duration = remainingIntervalMinutes
                    remainingIntervalMinutes = 0
                }
            }
        }
    }

    return {
        entries: transformPairs.map(p => p[1]),
        remainingIntervalMinutes: remainingIntervalMinutes,
        intervalStart: intervalStart,
        intervalEnd: intervalEnd,
    }
}

type DatePickerButtonProps = {
    tooltip: string
    children: ReactNode,
    onClick: () => void
}

const DatePickerButton = ({ tooltip, children, onClick }: DatePickerButtonProps) => (
    <Tooltip label={tooltip}><ActionIcon onClick={onClick} variant="white">{children}</ActionIcon></Tooltip>
)


type EnterTimeFormProps = {
    initialStart: Dayjs,
    initialEnd: Dayjs,
}

const EnterTimeForm = ({ initialStart, initialEnd }: EnterTimeFormProps) => {


    const timetracking = useTimeTracking()

    const initialValues: FormValue = {
        entries: [
            { activity: '', duration: '', key: randomId() },
        ],
        intervalStart: initialStart.format("YYYY-MM-DD HH:mm:ss"),
        intervalEnd: initialEnd.format("YYYY-MM-DD HH:mm:ss"),
    }
    const [transformedValues, setTransformedValues] = useState(calculateDurations(initialValues))

    const form = useForm<FormValue, TransformedFormValue>({
        mode: 'uncontrolled',
        initialValues: initialValues,
        validate: {
            entries: {
                [formRootRule]: (_, values) => {
                    const transformed = calculateDurations(values)
                    if (transformed.remainingIntervalMinutes != 0) {
                        return "Total durations must add up to interval duration!"
                    } else {
                        return null
                    }
                },
                activity: (value) => value ? null : "Activity is required",
                duration: validateDuration
            }
        },
        transformValues: calculateDurations,
    })

    const syncTransformedValues = () => {
        setTransformedValues(form.getTransformedValues())
    }

    const entries = form.getValues().entries;

    const datePickerProps: DateTimePickerProps = {
        highlightToday: true,
        dropdownType: "modal"
    }

    return (
        <form onSubmit={form.onSubmit((values) => {
            timetracking.addInterval({
                Start: values.intervalStart,
                End: values.intervalEnd,
                Activities: values.entries.reduce(
                    (acc, e) => ({ ...acc, [e.activity]: e.duration! }),
                    {} as Record<string, number>
                )
            })
            UIService.HideEnterTimeWindow()
        })} onBlur={syncTransformedValues}>
            <Group align="start">
                <Stack>
                    {entries.map((entry, index) => (
                        <Group align="start">
                            <ActionIcon variant="subtle" onClick={() => {
                                form.removeListItem('entries', index)
                                syncTransformedValues()
                            }}><TrashIcon /></ActionIcon>
                            <Autocomplete key={form.key(`entries.${index}.activity`)} placeholder="Activity" {...form.getInputProps(`entries.${index}.activity`)} data={timetracking.recentActivities ? timetracking.recentActivities : undefined} loading={timetracking.isLoading} />
                            <TextInput key={form.key(`entries.${index}.duration`)} placeholder="Duration" {...form.getInputProps(`entries.${index}.duration`)} />
                            <Text w="5em">{formatDuration(transformedValues.entries[index]?.duration)}</Text>
                        </Group>
                    ))}
                    {form.errors.entries && (
                        <Text c="red" mt={5} fz="sm">
                            {form.errors.entries}
                        </Text>
                    )}
                    <Button onClick={() => {
                        const index = form.getValues().entries.length;
                        form.insertListItem('entries', {
                            activity: '',
                            duration: '',
                            quantity: 1,
                            key: randomId(),
                        })
                        // DOM isn't ready yet, defer the focus
                        requestAnimationFrame(() => {
                            form.getInputNode(`entries.${index}.activity`)?.focus();
                        });
                    }}>Add</Button>
                    <Button type="submit">Submit</Button>
                </Stack>
                <Stack>
                    <Text>Remaining: {formatDuration(transformedValues.remainingIntervalMinutes)}</Text>
                    <DateTimePicker key={form.key("intervalStart")} {...datePickerProps} label="Range Start"
                        rightSection={<DatePickerButton tooltip={`Reset to ${initialStart.format("YYYY-MM-DD HH:mm")}`} onClick={() => {
                            form.setFieldValue("intervalStart", initialStart.format("YYYY-MM-DD HH:mm:ss"))
                            syncTransformedValues()
                        }}><ClockClockwiseIcon /></DatePickerButton>} {...form.getInputProps("intervalStart")} />
                    <DateTimePicker key={form.key("intervalEnd")} {...datePickerProps} label="Range End"
                        rightSection={<DatePickerButton tooltip="Update to now" onClick={() => {
                            form.setFieldValue("intervalEnd", dayjs().format("YYYY-MM-DD HH:mm:ss"))
                            syncTransformedValues()
                        }}><ArrowsClockwiseIcon /></DatePickerButton>}
                        {...form.getInputProps("intervalEnd")} />
                </Stack>
            </Group>
        </form>
    )
}

export const EnterTime = () => {
    const timetracking = useTimeTracking()
    const [sessionKey, setSessionKey] = useState(randomId())

      useEffect(() => {
        const unsubscribe = Events.On('timetracking:enterTime', () => {
            setSessionKey(randomId())
        });

        return () => {
            unsubscribe(); // Clean up listener on unmount
        };
    }, [])

    if (timetracking.isLoading) {
        return <LoadingOverlay visible={timetracking.isLoading} />
    } else {
        return <>
            <EnterTimeForm key={sessionKey} initialStart={timetracking.latestIntervalEnd || dayjs()} initialEnd={dayjs()} />
        </>
    }
}