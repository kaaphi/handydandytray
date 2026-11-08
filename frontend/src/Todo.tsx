import { ActionIcon, Anchor, Box, Button, Divider, Flex, Group, Menu, MenuProps, Modal, Paper, Stack, Table, Tabs, Text, Textarea, Transition } from "@mantine/core";
import { sortTodos, Todo, useTodos } from "./hooks/useTodos";
import { useCounter, useDisclosure, useHover, useUncontrolled } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUUpLeftIcon, CheckIcon, ClockIcon, DotsThreeIcon, PencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { DateInput, DatePickerInput, getTimeRange, TimePicker } from "@mantine/dates";
import { Dayjs } from "dayjs";
import dayjs from "./lib/dayjs"
import { TodoDateTime, WarnTypes } from "./lib/TodoDateTime";
import { TickerProvider } from "./lib/TickerContext";
import { isTodoTab, TodoTab, useTodoNavigationStore } from "./hooks/useTodoNavigationStore";
import { MarkdownViewer } from "./lib/MarkdownViewer";

import { triggerNotification } from "./lib/notifications";
import { DefaultErrorBoundary } from "./FallbackError";
import { RelativeTime } from "./lib/dayjs";

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

type ReminderInputProps = {
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    error?: React.ReactNode
}
const ReminderInput = ({ value, defaultValue, onChange, error }: ReminderInputProps) => {
    const [_value, setValue] = useUncontrolled({
        value,
        defaultValue,
        finalValue: '',
        onChange,
    });

    return (<>
    <SetReminderMenu onSetReminder={(reminder) => {setValue(reminder?.toISOString() ?? "")}} showClearReminder={!!_value}>
        <Anchor>
            {_value ? (
                <>Edit reminder (<RelativeTime time={dayjs(_value)}/>)</>
            ) : (
                "Add reminder"
            )}
        </Anchor>
    </SetReminderMenu>
    {error}
    </>
    )
}

const AddEditTodo = ({ close, todo }: AddEditTodoParams) => {
    const todos = useTodos()
    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            description: todo?.description ?? "",
            dueAt: todo?.dueAt ?? undefined,
            remindMeAt: todo?.remindMeAt ?? undefined
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
        <Stack>
            <Textarea label="Description" data-autofocus key={form.key("description")}
                {...form.getInputProps("description", { type: "input" })} onPaste={handlePaste} ref={textareaRef}
                minRows={3} maxRows={8} autosize
            />
            <DateInput label="Due Date" key={form.key("dueAt")} presets={[
                { value: dayjs().add(1, 'day').format('YYYY-MM-DD'), label: 'Tomorrow' },
                { value: dayjs().startOf("week").add(1, "week").weekday(1).format('YYYY-MM-DD'), label: 'Next Monday' },
            ]} highlightToday clearable {...form.getInputProps("dueAt", { type: "input" })} />
            <ReminderInput key={form.key("remindMeAt")} {...form.getInputProps("remindMeAt")}/>
            <Button type="submit">{todo ? "Save" : "Add Todo"}</Button>
        </Stack>
    </form>
}

type SetReminderMenuProps = {
    children: React.ReactNode,
    showClearReminder?: boolean
    onSetReminder: (remider?: Dayjs) => void
    onChange?: (opened: boolean) => void
} & MenuProps
const SetReminderMenu = ({children, showClearReminder, onSetReminder, onChange = _ => {}, ...menuProps} : SetReminderMenuProps) => {
    const [customOpened, setCustomOpened ] = useState(false)
    const [customDate, setCustomDate] = useState<string | null>(dayjs().format("YYYY-MM-DD"));
    const [customTime, setCustomTime] = useState("");
    const closeCustom = useCallback(() => {
        setCustomOpened(false)
        onChange(false)
        setCustomDate(dayjs().format("YYYY-MM-DD"))
        setCustomTime("")
    }, [setCustomOpened, onChange, setCustomDate, setCustomTime])
    const openCustom = useCallback(() => {
        setCustomOpened(true)
        onChange(true)
    }, [setCustomOpened, onChange])

    const options = [
        { value: dayjs().add(15, 'minute'), label: "15 Minutes" },
        { value: dayjs().add(30, 'minute'), label: "30 Minutes" },
        { value: dayjs().add(1, 'hour'), label: "1 Hour" },
        { value: dayjs().add(3, 'hour'), label: "3 Hours" },
        { value: dayjs().add(1, 'day').set("hour", 6).set("minute", 30).set("second", 0), label: "Tomorrow at 6:30" },
    ]



    return (<>
    <Modal title="Set Reminder" opened={customOpened} onClose={closeCustom}>
        <Stack>
        <DatePickerInput value={customDate} onChange={setCustomDate} placeholder="Select date" highlightToday valueFormat="YYYY-MM-DD" />
        <TimePicker value={customTime} onChange={setCustomTime} withDropdown closeDropdownOnPresetSelect presets={getTimeRange({ startTime: '06:00:00', endTime: '17:00:00', interval: '00:30:00' })} />
        <Button disabled={!customDate || !customTime} onClick={() => {
            onSetReminder(dayjs(`${customDate} ${customTime}`, "YYYY-MM-DD HH:mm:ss"))
            closeCustom()
        }}>Set Reminder</Button>
        </Stack>
    </Modal>
    <Menu onChange={onChange} {...menuProps}>
        <Menu.Target>
            {children}
        </Menu.Target>

        <Menu.Dropdown>
            {options.map((option) =>
                <Menu.Item onClick={() => onSetReminder(option.value)}>{option.label}</Menu.Item>
            )}
            <Menu.Divider />
            {showClearReminder && <Menu.Item color="red" onClick={() => onSetReminder(undefined)}>Clear Reminder</Menu.Item>}
            <Menu.Item onClick={(e) => {
                openCustom()
            }}>Custom...</Menu.Item>
        </Menu.Dropdown>
    </Menu>
    </>
    )
}

type TodoItemParams = {
    todo: Todo,
    openEditTodo?: (todo?: Todo) => void,
    id?: string,
    isHighlighted: boolean,
}

const TodoItem = (params: TodoItemParams) => {
    const { todo, id, isHighlighted } = params
    const { hovered, ref } = useHover();

    return <Table.Tr pos="relative" ref={ref} id={id} bg={isHighlighted ? 'var(--mantine-primary-color-0)' : undefined}
        style={{
            transition: 'background-color 0.5s ease',
        }}>
        <Table.Td>
            <Stack>
                <Group gap="sm">
                    <TodoDateTime time={todo.createdAt} format="date" label="Created on" />
                    {!todo.completedAt && todo.dueAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt ? undefined : todo.dueAt} format="relativeDate" label="Due" overdueLabel="Was due" warningType={WarnTypes.dueOnDate} />
                    {!todo.completedAt && todo.remindMeAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt ? undefined : todo.remindMeAt} format="relativeTime" label="Remind me" overdueLabel="Reminder overdue" warningType={WarnTypes.dueAtTime} />
                    {todo.completedAt && <Divider orientation="vertical" />}
                    <TodoDateTime time={todo.completedAt} format="relativeTime" label="Completed" />
                </Group>
                <Text>
                    <MarkdownViewer markdown={todo.description} />
                </Text>
            </Stack>
            <TodoItemControls isActive={hovered} {...params} />
        </Table.Td>
    </Table.Tr>
}

type TodoItemControlsParams = TodoItemParams & {
    isActive: boolean,
}

const TodoItemControls = ({ isActive, todo, openEditTodo = () => { } }: TodoItemControlsParams) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)
    //we use a counter here instead of a simple boolean state because we can have multiple components stack keep alive needs, we need to keep track of when none of them are keeping the controls alive anymore
    const [keepActiveCounter, keepActiveHandlers] = useCounter(0)
    const updateKeepActive = useCallback((value: boolean) => {
        if (value) {
            keepActiveHandlers.increment()
        } else {
            keepActiveHandlers.decrement()
        }
    }, [keepActiveHandlers.increment, keepActiveHandlers.decrement])
    
    const setReminder = useCallback((remindMeAt?: Dayjs) => {
        todo.remindMeAt = remindMeAt
        todos.updateTodo(todo)
    }, [todos, todo])

    return (
        <Transition transition="fade" duration={250} mounted={isActive || keepActiveCounter > 0}>
            {(styles) => (
                <Paper style={styles} pos="absolute" top={0}
                    right={0} radius="md" withBorder p="xs" mt="1rem" mr="1rem">
                    <Group>
                        <ActionIcon variant="light" size="sm" onClick={e => {
                            todo.completedAt = isCompleted ? undefined : dayjs()
                            todos.updateTodo(todo)
                        }}>{isCompleted ? <ArrowUUpLeftIcon /> : <CheckIcon />}</ActionIcon>
                        {!isCompleted && <SetReminderMenu onChange={updateKeepActive} onSetReminder={setReminder} showClearReminder={!!todo.remindMeAt}><ActionIcon size="sm" variant="subtle"><ClockIcon /></ActionIcon></SetReminderMenu>}
                        {isCompleted && <ActionIcon size="sm" variant="subtle" color="red" onClick={() => todos.deleteTodo(todo)}><TrashIcon /></ActionIcon>}
                        {!isCompleted && <Menu onChange={updateKeepActive}>
                            <Menu.Target>
                                <ActionIcon size="sm" variant="subtle"><DotsThreeIcon /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item onClick={() => openEditTodo(todo)} leftSection={<PencilIcon />}>Edit</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item onClick={() => todos.deleteTodo(todo)} color="red" leftSection={<TrashIcon />}>Remove</Menu.Item>
                                {import.meta.env.DEV && <Menu.Item onClick={() => {
                                    triggerNotification({
                                        type: "todo",
                                        props: {
                                            todoId: todo.id
                                        }
                                    })
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
    const highlightedId = useTodoNavigationStore((s) => s.targetTodoId)
    const clearHighlightedId = useTodoNavigationStore((s) => s.clearTargetTodo)
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scrollToItem = (id: string) => {
        console.log("Window scroll position:", window.scrollY)
        const element = document.getElementById(`todo-${id}`);
        element?.scrollIntoView({ behavior: "smooth", block: "start" });

        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => {
            console.log("Clearing highlighted id", highlightedId)
            clearHighlightedId()
        }, 1000);
    };

    useEffect(() => {
        if (!highlightedId) {
            return
        }

        // requestAnimationFrame ensures the newly mounted DOM elements 
        // have been painted before querying getElementById
        const frameId = requestAnimationFrame(() => {
            scrollToItem(highlightedId)
        });

        return () => {
            if (highlightTimer.current) {
                console.log("Clearing timeout")
                clearTimeout(highlightTimer.current);
            }

            cancelAnimationFrame(frameId)
        };
    }, [highlightedId, highlightTimer])

    return (
        <Table.ScrollContainer minWidth={0} style={{ flex: 1 }}>
            <Table verticalSpacing="lg" horizontalSpacing="md">
                <Table.Tbody>
                    {items.map((todo) => <TodoItem key={todo.id} id={`todo-${todo.id}`} todo={todo} isHighlighted={todo.id === highlightedId} {...todoItemParams} />)}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    )
}

type InProgressProperties = {
    openEditTodo: (todo?: Todo) => void,
}

const InProgress = ({ openEditTodo }: InProgressProperties) => {
    return (
        <>
            <TodoList todoItemParams={{
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
    const activeTab = useTodoNavigationStore((s) => s.activeTab)
    const setActiveTab = useTodoNavigationStore((s) => s.setActiveTab)

    const openAddEditTodo = useCallback((todo?: Todo) => {
        setTodoToEdit(todo)
        openAddTodoModal()
    }, [openAddTodoModal, setTodoToEdit])


    return (
        <DefaultErrorBoundary>
            <TickerProvider>
                {/* Root container fills entire window height and prevents global window scrolling */ }
                <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Modal opened={addTodoOpened} onClose={closeAddTodo} title={todoToEdit ? "Edit Todo" : "Add Todo"}>
                        <AddEditTodo close={closeAddTodo} todo={todoToEdit} />
                    </Modal>
                    <Tabs value={activeTab} onChange={(value) => {
                        if (isTodoTab(value)) {
                            setActiveTab(value)
                        }
                    }} keepMounted={false} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <Flex justify="space-between" align="center" w="100%">
                            <Tabs.List style={{ flexShrink: 0 }}>
                                <Tabs.Tab value="inProgress">
                                    In Progress
                                </Tabs.Tab>
                                <Tabs.Tab value="completed">
                                    Completed
                                </Tabs.Tab>

                            </Tabs.List>
                            <Button size="md" variant="subtle" disabled={todos.isLoading} onClick={() => openAddEditTodo()} leftSection={<PlusIcon />}>Add Todo</Button>
                        </Flex>
                        <Tabs.Panel value={TodoTab.inProgress} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <InProgress openEditTodo={openAddEditTodo} />
                        </Tabs.Panel>

                        <Tabs.Panel value={TodoTab.completed} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <Completed />
                        </Tabs.Panel>
                    </Tabs>
                </Box>
            </TickerProvider>
        </DefaultErrorBoundary>
    )
}