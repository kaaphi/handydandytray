import { ActionIcon, Box, Button, Divider, Flex, Group, Menu, Modal, Paper, ScrollArea, Stack, Table, Tabs, Text, Textarea, TextProps, Transition, Typography } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import { convertTodoToGo, sortTodos, Todo, useTodos } from "./hooks/useTodos";
import { useDisclosure, useHover } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { marked } from "marked";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUUpLeftIcon, CheckIcon, ClockIcon, DotsThreeIcon, InfoIcon, PencilIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { DateInput, DatePickerInput, getTimeRange, TimePicker } from "@mantine/dates";
import dayjs, { Dayjs } from "dayjs";
import { UIService } from "../bindings/handydandytray";
import { RelativeTime } from "./lib/dayjs";
import { TickerProvider } from "./lib/TickerContext";

const convertLinkUrl = (url: string): string => {
    if (url.startsWith("https://teams.live.com") || url.startsWith("https://teams.microsoft.com")) {
        //replace https:// with msteams://
        return "msteams://" + url.slice(8)
    } else {
        return url;
    }
}

type AddEditTodoParams = {
    todo?: Todo
    close: () => void
}

const AddEditTodo = ({ close, todo }: AddEditTodoParams) => {
    const todos = useTodos()
    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            description: todo ? todo.description : "",
            dueAt: todo ? todo.dueAt : undefined,
        },
        validate: {
            description: (value) => value.length > 0 ? null : "Invalid description",
        }
    })

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const htmlData = e.clipboardData.getData('text/html');

        if (!htmlData) return; // Allow normal paste if no HTML content exists

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const anchor = doc.querySelector('a');

        if (anchor && anchor.href) {
            const linkText = (anchor.textContent || anchor.href).replace(/\s+/g, ' ').trim();

            if (linkText === anchor.href) return;

            e.preventDefault();

            const url = convertLinkUrl(anchor.href)

            const markdownLink = `[${linkText}](${url})`;
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // 1. Replace the selected range (or cursor position) and place cursor at the end of inserted text
            textarea.setRangeText(markdownLink, start, end, 'end');

            // 2. Dispatch a native input event so Mantine/React form handlers recognize the DOM change
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        };
    }

    return <form onSubmit={form.onSubmit((values) => {
        console.log("Form submit", values)
        if (!todo) {
            todos.createTodo(values)
        } else {
            todos.updateTodo({
                ...todo,
                ...values,
            })
        }
        close()
    })}>
        <Textarea data-autofocus placeholder="description" key={form.key("description")} 
        {...form.getInputProps("description", { type: "input" })} onPaste={handlePaste} ref={textareaRef} 
        minRows={3} maxRows={8} autosize
        />
        <DateInput key={form.key("dueAt")} placeholder="due date" presets={[
            { value: dayjs().add(1, 'day').format('YYYY-MM-DD'), label: 'Tomorrow' },
            { value: dayjs().startOf("week").add(1, "week").weekday(1).format('YYYY-MM-DD'), label: 'Next Monday' },
        ]} highlightToday clearable {...form.getInputProps("dueAt", { type: "input" })} />
        <Button type="submit">{todo ? "Save" : "Add Todo"}</Button>
    </form>
}

const SetReminder = ({ todo, close }: { todo: Todo, close: () => void }) => {
    const todos = useTodos()
    const [customOpened, { open: openCustom }] = useDisclosure(false)
    const [customDate, setCustomDate] = useState<string | null>(dayjs().format("YYYY-MM-DD"));
    const [customTime, setCustomTime] = useState("");

    const setReminder = (reminder?: Dayjs) => () => {
        todo.remindMeAt = reminder
        todos.updateTodo(todo)
        close()
    }

    const options = [
        { value: dayjs().add(15, 'minute'), label: "15 Minutes" },
        { value: dayjs().add(30, 'minute'), label: "30 Minutes" },
        { value: dayjs().add(1, 'hour'), label: "1 Hour" },
        { value: dayjs().add(3, 'hour'), label: "3 Hours" },
        { value: dayjs().add(1, 'day').set("hour", 6).set("minute", 30).set("second", 0), label: "Tomorrow" },
    ]

    return (
        <Stack gap="xs">
            {options.map((option) =>
                <Button variant="subtle" onClick={setReminder(option.value)}>{option.label}</Button>
            )}
            <Divider />
            {todo.remindMeAt && <Button variant="subtle" color="red" onClick={setReminder(undefined)}>Clear Reminder</Button>}
            <Button variant="subtle" onClick={openCustom}>Custom</Button>
            {customOpened && <>
                <DatePickerInput value={customDate} onChange={setCustomDate} placeholder="Select date" highlightToday valueFormat="YYYY-MM-DD" />
                <TimePicker value={customTime} onChange={setCustomTime} withDropdown closeDropdownOnPresetSelect presets={getTimeRange({ startTime: '06:00:00', endTime: '17:00:00', interval: '00:30:00' })} />
                <Button disabled={!customDate || !customTime} onClick={setReminder(dayjs(`${customDate} ${customTime}`, "YYYY-MM-DD HH:mm:ss"))}>Set Reminder</Button>
            </>}
        </Stack>
    )
}

type TodoItemParams = {
    todo: Todo,
    editReminder?: (todo: Todo) => void,
    openEditTodo?: (todo?: Todo) => void,
    id?: string,
    isHighlighted: boolean,
}



const TodoItem = (params: TodoItemParams) => {
    const { todo, id, isHighlighted } = params
    const { hovered, ref } = useHover();

    return <Table.Tr pos="relative" ref={ref} id={id} bg={isHighlighted ? 'var(--mantine-primary-color-0)' : undefined}
            style={{
                transition: 'background-color 0.3s ease',
            }}>
        <Table.Td>
            <Stack>
                <Group gap="sm">
                    <TodoDateTime time={todo.createdAt} format="date" label="Created on" />
                    {!todo.completedAt && todo.dueAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt ? undefined : todo.dueAt } format="relativeDate" label="Due" overdueLabel="Was due" warningType={WarnTypes.dueOnDate}/>
                    {!todo.completedAt && todo.remindMeAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt ? undefined : todo.remindMeAt} format="relativeTime" label="Remind me" overdueLabel="Reminder overdue" warningType={WarnTypes.dueAtTime}/>
                    {todo.completedAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt} format="relativeTime" label="Completed" />
                </Group>
                <Text>
                    <Typography>
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
                    </Typography>
                </Text>
            </Stack>
            <TodoItemControls isActive={hovered} {...params} />
        </Table.Td>
    </Table.Tr>
}

type TodoItemControlsParams = TodoItemParams & {
    isActive: boolean,
}

const TodoItemControls = ({ isActive, todo, editReminder = () => { }, openEditTodo = () => { } }: TodoItemControlsParams) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)
    const [menuOpened, setMenuOpened] = useState(false)
    return (
        <Transition transition="fade" duration={250} mounted={isActive || menuOpened}>
            {(styles) => (
                <Paper style={styles} pos="absolute" top={0}
                    right={0} radius="md" withBorder p="xs" mt="1rem" mr="1rem">
                    <Group>
                        <ActionIcon variant="light" size="sm" onClick={e => {
                            todo.completedAt = isCompleted ? undefined : dayjs()
                            todos.updateTodo(todo)
                        }}>{isCompleted ? <ArrowUUpLeftIcon /> : <CheckIcon />}</ActionIcon>
                        {!isCompleted && <ActionIcon size="sm" variant="subtle" onClick={() => editReminder(todo)}><ClockIcon /></ActionIcon>}
                        {isCompleted && <ActionIcon size="sm" variant="subtle" color="red" onClick={() => todos.deleteTodo(todo)}><TrashIcon /></ActionIcon>}
                        {!isCompleted && <Menu onChange={setMenuOpened}>
                            <Menu.Target>
                                <ActionIcon size="sm" variant="subtle"><DotsThreeIcon /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item onClick={() => openEditTodo(todo)} leftSection={<PencilIcon />}>Edit</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item onClick={() => todos.deleteTodo(todo)} color="red" leftSection={<TrashIcon />}>Remove</Menu.Item>
                                {import.meta.env.DEV && <Menu.Item onClick={() => {
                                    console.log("Showing reminder for", todo)
                                    UIService.ShowTodoReminder(convertTodoToGo(todo))
                                }}>Test Reminder</Menu.Item>}
                            </Menu.Dropdown>
                        </Menu>}
                    </Group>
                </Paper>
            )}
        </Transition>
    )
}

type TodoListParams = {
    completed?: boolean,
    todoItemParams?: Partial<TodoItemParams>
    processTodos?: (todos: Todo[]) => Todo[]
}

const TodoList = ({ completed = false, todoItemParams = {}, processTodos }: TodoListParams) => {
    const todos = useTodos(completed)
    const items = processTodos ? processTodos(todos.todos) : todos.todos

    // State for active highlight + ref to manage timer cleanup
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scrollToItem = (id: string) => {
        console.log("Window scroll position:", window.scrollY)
        const element = document.getElementById(`todo-${id}`);
        element?.scrollIntoView({ behavior: "smooth", block: "start" });

        // Trigger highlight and auto-clear after delay
        setHighlightedId(id);

        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => {
            console.log("Clearing highlighted id", highlightedId)
            setHighlightedId(null);
        }, 500);
    };

    useEffect(() => {
        const unsubscribe = Events.On('todo:reminderClicked', (event) => {
            const todoId = event.data as string;
            console.log("Scrolling to todo", todoId)
            if (todoId) {
                scrollToItem(todoId)
            }
        });

        return () => {
            if (highlightTimer.current) {
                console.log("Clearing timeout")
                clearTimeout(highlightTimer.current);
            }
            unsubscribe(); // Clean up listener on unmount
        };
    }, [])

    return (
        <ScrollArea style={{ flex: 1 }}>
            <Table verticalSpacing="lg" horizontalSpacing="md">
                {items.map((todo) => <TodoItem key={todo.id} id={`todo-${todo.id}`} todo={todo} isHighlighted={todo.id === highlightedId} {...todoItemParams} />)}
            </Table>
        </ScrollArea>
    )
}


const InProgress = ({ openEditTodo }: { openEditTodo: (todo?: Todo) => void }) => {
    const [editReminderTodo, setEditReminderTodo] = useState<Todo | null>(null)

    return (
        <>
            <Modal opened={!!editReminderTodo} onClose={() => setEditReminderTodo(null)} title="Remind Me">
                {editReminderTodo && <SetReminder todo={editReminderTodo} close={() => setEditReminderTodo(null)} />}
            </Modal>
            <TodoList todoItemParams={{
                editReminder: setEditReminderTodo,
                openEditTodo: openEditTodo,
            }} processTodos={sortTodos} />
        </>
    )
}

const Completed = () => {
    return (
        <TodoList completed={true} />
    )
}

export const Todos = () => {
    const [todoToEdit, setTodoToEdit] = useState<Todo | undefined>(undefined)
    const [addTodoOpened, { open: openAddTodoModal, close: closeAddTodo }] = useDisclosure(false)
    const todos = useTodos()

    const openAddEditTodo = useCallback((todo?: Todo) => {
        setTodoToEdit(todo)
        openAddTodoModal()
    }, [openAddTodoModal, setTodoToEdit])


    return (
        // 1. Root container fills entire window height and prevents global window scrolling
        <TickerProvider>
        <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Modal opened={addTodoOpened} onClose={closeAddTodo} title={todoToEdit ? "Edit Todo" : "Add Todo"}>
                <AddEditTodo close={closeAddTodo} todo={todoToEdit} />
            </Modal>
            <Tabs defaultValue="inProgress" keepMounted={false} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <Flex justify="space-between" align="center" w="100%">
                    <Tabs.List style={{ flexShrink: 0 }}>
                        <Tabs.Tab value="inProgress">
                            In Progress
                        </Tabs.Tab>
                        <Tabs.Tab value="completed">
                            Completed
                        </Tabs.Tab>

                    </Tabs.List>
                    <Button size="md" variant="subtle" disabled={todos.isLoading} onClick={() => openAddEditTodo()} leftSection={<PlusIcon/>}>Add Todo</Button>
                </Flex>
                <Tabs.Panel value="inProgress" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <InProgress openEditTodo={openAddEditTodo} />
                </Tabs.Panel>

                <Tabs.Panel value="completed" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Completed />
                </Tabs.Panel>
            </Tabs>
        </Box>
        </TickerProvider>
    )
}

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

type WarnType = {
    styleChooser: (time: Dayjs) => ConditionalDateTimeStyle,
    isOverdue: (time: Dayjs) => boolean,
}

const WarnTypes: Record<string, WarnType> = {
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

const TodoDateTime = ({time, label, overdueLabel, format, warningType = WarnTypes.none} : ConditionalDateTimeProps) => {
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