import { ActionIcon, Autocomplete, Button, ComboboxItem, Group, LoadingOverlay, Menu, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { formRootRule, useForm } from "@mantine/form";
import { randomId } from "@mantine/hooks";
import { ArrowsClockwiseIcon, ClockClockwiseIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Dayjs } from "dayjs";
import dayjs from "./lib/dayjs"
import { useEffect, useState, type ReactNode } from "react";
import { Events } from '@wailsio/runtime';
import { DateTimePicker, DateTimePickerProps } from "@mantine/dates";
import { getInitalStartFromBaselines, IntervalStartBaselines, useTimeTracking } from "./hooks/useTimeTracking";
import { UIService } from "../bindings/handydandytray/internal/ui";
import { DefaultErrorBoundary } from "./FallbackError";
import { ConditionalWrapper } from "./lib/ConditionalWrapper";
import { formatHourMinuteDuration } from "./lib/dayjs";

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
    //we add a second to the end to ensure we get the full final minute in the interval instead of truncating down
    let remainingIntervalMinutes = intervalEnd.add(1, "second").diff(intervalStart, "minutes")

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
    tooltip?: string
    children: ReactNode,
    onDateSelect: (value: Dayjs) => void,
    options: Record<string, Dayjs | undefined>,
}
const DatePickerButton = ({ tooltip, children, onDateSelect, options: optionsObject }: DatePickerButtonProps) => {
    const options = Object.entries(optionsObject).filter(option => option[1]) as [string, Dayjs][]


    const buttonOnClick = options.length == 1 ? () => onDateSelect(options[0][1]) : undefined

    const actionIconButton = <ActionIcon onClick={buttonOnClick} disabled={options.length == 0} variant="white">{children}</ActionIcon>

    if (options.length < 2) {
        return (
            <ConditionalWrapper condition={tooltip} wrap={children => <Tooltip label={tooltip}>{children}</Tooltip>}>{actionIconButton}</ConditionalWrapper>
        )
    } else {
        return (
            <Menu>
                <ConditionalWrapper condition={tooltip} wrap={children => <Tooltip label={tooltip}>{children}</Tooltip>}>
                    <Menu.Target>
                        <ActionIcon onClick={buttonOnClick} disabled={options.length == 0} variant="white">{children}</ActionIcon>
                    </Menu.Target>
                </ConditionalWrapper>

                <Menu.Dropdown>
                    {options.map(([key, value]) => (
                        <Menu.Item key={key} onClick={() => onDateSelect(value)}>{`${key} (${value.format("YYYY-MM-DD HH:mm")})`}</Menu.Item>
                    ))}
                </Menu.Dropdown>
            </Menu>
        )
    }
}


type EnterTimeFormProps = {
    startBaselines?: IntervalStartBaselines
    initialEnd: Dayjs,
}

const categoryFilter = ({options, search}) => {
    return !search ? [] : (options as ComboboxItem[]).filter((option) => option.label.toLowerCase().startsWith(search.toLowerCase()))
}

const EnterTimeForm = ({ startBaselines, initialEnd }: EnterTimeFormProps) => {
    const initialStart = getInitalStartFromBaselines(startBaselines).startOf("minute")
    console.log("Baselines", startBaselines, "initialStart", initialStart)

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
        dropdownType: "modal",
        valueFormat: "YYYY/MM/DD HH:mm",
    }

    const addItem = () => {
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
    }

    const setDateFormField = (formField: string) => (value: Dayjs) => {
        form.setFieldValue(formField, value.startOf("minute").format("YYYY-MM-DD HH:mm:ss"))
        syncTransformedValues()
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
            <Stack align="stretch" justify="space-between" h="100vh" p="xs" >
                <Group align="start" justify="space-between" wrap="nowrap">
                        <Stack>
                        {entries.map((_, index) => (
                            <Group align="start">
                                <ActionIcon pt={4} tabIndex={1} variant="subtle" onClick={() => {
                                    form.removeListItem('entries', index)
                                    syncTransformedValues()
                                }}><TrashIcon /></ActionIcon>
                                <Autocomplete 
                                    autoFocus={index == 0}
                                    maxDropdownHeight="5.5rem"
                                    filter={categoryFilter}
                                    selectFirstOptionOnChange
                                    autoSelectOnBlur 
                                    tabIndex={1}
                                    key={form.key(`entries.${index}.activity`)}
                                    placeholder="Activity"
                                    data={timetracking.recentActivities ?? undefined}
                                    loading={timetracking.isLoading}
                                    {...form.getInputProps(`entries.${index}.activity`)}
                                />
                                <TextInput tabIndex={1} key={form.key(`entries.${index}.duration`)} placeholder="Duration" {...form.getInputProps(`entries.${index}.duration`)} />
                                <Text pt={4} w="5em">{formatHourMinuteDuration(transformedValues.entries[index]?.duration)}</Text>
                            </Group>
                        ))}
                        {form.errors.entries && (
                            <Text c="red" mt={5} fz="sm" style={{flexShrink: 0}}>
                                {form.errors.entries}
                            </Text>
                        )}
                        </Stack>
                    <Stack>
                        <Button tabIndex={1} onClick={addItem} variant="outline" leftSection={<PlusIcon />}>Add</Button>
                        <Text>Remaining: {formatHourMinuteDuration(transformedValues.remainingIntervalMinutes)}</Text>
                        <DateTimePicker key={form.key("intervalStart")} {...datePickerProps} label="Range Start"
                            rightSection={<DatePickerButton onDateSelect={setDateFormField("intervalStart")} options={{
                                "Last interval end": startBaselines?.lastIntervalEnd,
                                "Manual baseline": startBaselines?.manual,
                                "Application start": startBaselines?.appStart,
                            }}><ClockClockwiseIcon /></DatePickerButton>} {...form.getInputProps("intervalStart")} />
                        <DateTimePicker key={form.key("intervalEnd")} {...datePickerProps} label="Range End"
                            rightSection={<DatePickerButton tooltip="Update to now" onDateSelect={setDateFormField("intervalEnd")} options={{now: dayjs()}}><ArrowsClockwiseIcon /></DatePickerButton>}
                            {...form.getInputProps("intervalEnd")} />
                    </Stack>
                </Group>
                <Button tabIndex={1} type="submit" variant="light">Submit</Button>
            </Stack>
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
        return (
            <DefaultErrorBoundary><EnterTimeForm key={sessionKey} startBaselines={timetracking.intervalStartBaselines} initialEnd={dayjs().startOf("minute")} /></DefaultErrorBoundary>
        )
    }
}