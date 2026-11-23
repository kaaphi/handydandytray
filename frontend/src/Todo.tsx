import { ActionIcon, Alert, Anchor, Box, Button, Divider, Flex, Group, Menu, MenuProps, Modal, Paper, Stack, Table, Tabs, Text, Textarea, Transition } from "@mantine/core";
import { compareActiveTodoForSort, Todo, TodoData, useTodos } from "./hooks/useTodos";
import { useCounter, useDisclosure, useUncontrolled } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUUpLeftIcon, CaretDownIcon, CaretUpIcon, CheckIcon, ClockIcon, DotsThreeIcon, LightningIcon, LightningSlashIcon, PencilIcon, PlusIcon, QuestionIcon, TrashIcon } from "@phosphor-icons/react";
import { DateInput, DatePickerInput, getTimeRange, TimePicker } from "@mantine/dates";
import { Dayjs } from "dayjs";
import dayjs from "./lib/dayjs";
import { TodoDateTime, WarnTypes } from "./lib/TodoDateTime";
import { TickerProvider } from "./lib/TickerContext";
import { isTodoTab, TodoTab, useTodoNavigationStore } from "./hooks/useTodoNavigationStore";
import { MarkdownViewer } from "./lib/MarkdownViewer";

import { triggerNotification } from "./lib/notifications";
import { DefaultErrorBoundary } from "./FallbackError";
import { RelativeTime } from "./lib/dayjs";
import { FadeSpoiler } from "./lib/FadeSpoiler";
import { TooltipActionIcon } from "./lib/TooltipActionIcon";
import { useHover } from "./hooks/useHover";

const convertLinkUrl = (url: string): string => {
    if (url.startsWith("https://teams.live.com") || url.startsWith("https://teams.microsoft.com")) {
        //replace https:// with msteams://
        return "msteams://" + url.slice(8)
    } else {
        return url;
    }
}


type TodoListItem = {
    index: number
} & Todo

const hasTodoIndexChanged = (todos: Todo[], originalTodo: TodoListItem, updatedTodo: Todo): boolean => {
    const now = dayjs()

    const todoBefore = originalTodo.index == 0 ? undefined : todos[originalTodo.index - 1]
    const todoAfter = originalTodo.index == todos.length - 1 ? undefined : todos[originalTodo.index + 1]

    if (todoBefore && compareActiveTodoForSort(todoBefore, updatedTodo, now) >= 0) {
        return true
    }

    if (todoAfter && compareActiveTodoForSort(updatedTodo, todoAfter, now) >= 0) {
        return true
    }

    return false
}

const useUpdateTodoWithNavigate = () => {
    const todos = useTodos()
    const navigateToTodo = useTodoNavigationStore((s) => s.navigateToTodo)

    return async (todo: TodoListItem, values: Partial<TodoData>) => {

        const newTodo: Todo = {
            ...todo,
            ...values,
        }

        const isUncompleted = todo.completedAt && !newTodo.completedAt

        const doNavigate = isUncompleted || (!newTodo.completedAt && hasTodoIndexChanged(todos.todos, todo, newTodo))

        todos.updateTodo(newTodo)
        if (doNavigate) {
            navigateToTodo(todo.id)
        }

        return doNavigate
    }
}

type ReminderInputProps = {
    value?: Dayjs
    defaultValue?: Dayjs
    onChange?: (value?: Dayjs) => void
    error?: React.ReactNode
}
const ReminderInput = ({ value, defaultValue, onChange, error }: ReminderInputProps) => {
    const [_value, setValue] = useUncontrolled<Dayjs | undefined>({
        value,
        defaultValue,
        finalValue: undefined,
        onChange,
    });

    return (<>
        <SetReminderMenu currentReminder={_value} onSetReminder={(reminder) => { setValue(reminder) }} showClearReminder={!!_value}>
            <Anchor>
                {_value ? (
                    <>Edit reminder (<RelativeTime time={_value} />)</>
                ) : (
                    "Add reminder"
                )}
            </Anchor>
        </SetReminderMenu>
        {error}
    </>
    )
}

type AddEditTodoProps = {
    todo?: TodoListItem
    close: () => void
}
const AddEditTodo = ({ close, todo }: AddEditTodoProps) => {
    const todos = useTodos()
    const navigateToTodo = useTodoNavigationStore((s) => s.navigateToTodo)
    const updateTodoWithNavigate = useUpdateTodoWithNavigate()
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

    return <form onSubmit={form.onSubmit(async (values) => {
        console.log("Form submit", values)
        if (!todo) {
            const todoId = await todos.createTodo(values)
            navigateToTodo(todoId)
        } else {
            updateTodoWithNavigate(todo, values)
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
            <ReminderInput key={form.key("remindMeAt")} {...form.getInputProps("remindMeAt")} />
            <Button type="submit">{todo ? "Save" : "Add Todo"}</Button>
        </Stack>
    </form>
}

type SetReminderMenuProps = {
    children: React.ReactNode
    showClearReminder?: boolean
    onSetReminder: (remider?: Dayjs) => void
    onChange?: (opened: boolean) => void
    currentReminder?: Dayjs
} & MenuProps
const SetReminderMenu = ({ children, showClearReminder, onSetReminder, currentReminder, onChange = _ => { }, ...menuProps }: SetReminderMenuProps) => {
    const [customOpened, setCustomOpened] = useState(false)
    const [customDate, setCustomDate] = useState<string | null>((currentReminder ?? dayjs()).format("YYYY-MM-DD"));
    const [customTime, setCustomTime] = useState(currentReminder?.format("HH:mm") ?? "");
    const closeCustom = useCallback(() => {
        setCustomOpened(false)
        onChange(false)
        setCustomDate((currentReminder ?? dayjs()).format("YYYY-MM-DD"))
        setCustomTime(currentReminder?.format("HH:mm") ?? "")
    }, [setCustomOpened, onChange, setCustomDate, setCustomTime])
    const openCustom = useCallback(() => {
        setCustomOpened(true)
        onChange(true)
    }, [setCustomOpened, onChange, currentReminder])

    const devOptions = !import.meta.env.DEV ? [] : [
        { value: dayjs().add(10, 'second'), label: "10 Seconds" },
        { value: dayjs().add(30, 'second'), label: "30 Seconds" },
        { value: dayjs().add(1, 'minute'), label: "1 Minute" },
    ]

    const options = [
        { value: dayjs().add(15, 'minute'), label: "15 Minutes" },
        { value: dayjs().add(30, 'minute'), label: "30 Minutes" },
        { value: dayjs().add(1, 'hour'), label: "1 Hour" },
        { value: dayjs().add(3, 'hour'), label: "3 Hours" },
        { value: dayjs().add(1, 'day').set("hour", 6).set("minute", 30).set("second", 0), label: "Tomorrow at 6:30" },
        ...devOptions
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
        <Menu
            onChange={onChange}
            {...menuProps}
            // the middlewares handle making the menu scroll if there's not enough room to display the whole thing
            middlewares={{
                flip: true,
                shift: true,
                size: {
                    padding: 8, // Keeps an 8px gap from the window edge
                    apply({ availableHeight, elements }) {
                        Object.assign(elements.floating.style, {
                            maxHeight: `${Math.max(80, availableHeight)}px`, //the 80 is a minimum height for the menu so it doesn't become completely unusable in extreme layout situations
                            overflowY: 'auto',
                        });
                    },
                },
            }}
        >
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

const SpoilerTypes = {
    show: {
        label: "Expand",
        icon: <CaretDownIcon />,
    },
    hide: {
        label: "Collapse",
        icon: <CaretUpIcon />,
    }
}
type SpoilerLabelProps = {
    type: "show" | "hide"
}
const SpoilerLabel = ({type: labelType} : SpoilerLabelProps) => {
    const spoiler = SpoilerTypes[labelType]
    return <Group gap="xs" align="center" c="gray.8">
        <Text span size="xs">{spoiler.label} </Text>
        {spoiler.icon}
    </Group>
}

type TodoItemHeaderProps = {
    todo: TodoListItem
}
const TodoItemHeader = ({ todo }: TodoItemHeaderProps) => {
    const headerItems: ReactNode[] = [
        todo.inProgress ? <Group align="center" gap="xs"><LightningIcon weight="bold" /><Text size="xs" fw="700">In Progress</Text></Group> : null,
        !todo.inProgress ? <TodoDateTime time={todo.createdAt!} format="date" label="Created on" /> : null,
        !todo.completedAt && todo.dueAt ? <TodoDateTime time={todo.dueAt} format="relativeDate" label="Due" overdueLabel="Was due" warningType={WarnTypes.dueOnDate} /> : null,
        !todo.completedAt && todo.remindMeAt ? <TodoDateTime time={todo.remindMeAt} format="relativeTime" label="Remind me" overdueLabel="Reminder overdue" warningType={WarnTypes.dueAtTime} /> : null,
        todo.completedAt ? <TodoDateTime time={todo.completedAt} format="relativeTime" label="Completed" /> : null,
    ]
        .filter(item => item != null)
        .flatMap((item, idx) => idx == 0 ? [item] : [<Divider orientation="vertical" />, item])

    return <Group gap="sm" align="center">
        {headerItems}
    </Group>
}

type TodoItemProps = {
    todo: TodoListItem,
    openEditTodo?: (todo?: TodoListItem) => void,
    id?: string,
    isHighlighted: boolean,
    showInProgressToggle: boolean,
}
const TodoItem = (params: TodoItemProps) => {
    const { todo, id, isHighlighted } = params
    const { hovered, ref, setHovered } = useHover();

    return <Table.Tr pos="relative" ref={ref} id={id}
        style={{
            transition: 'background-color 0.5s ease',
            ...(isHighlighted ? {
                backgroundColor: "var(--mantine-primary-color-0)"
            } : {}),
            ...(todo.inProgress ? {
                transition: undefined,
                borderLeft: "2px solid gray", 
                backgroundColor: "var(--mantine-color-gray-0)",
            } : {})
        }}>
        <Table.Td>
            <Stack>
                <TodoItemHeader todo={todo} />
                <FadeSpoiler maxHeight={150} showLabel={<SpoilerLabel type="show" />} hideLabel={<SpoilerLabel type="hide" />} styles={{control: {textDecoration: "none"}}}>
                    <MarkdownViewer markdown={todo.description} style={{ overflowWrap: "anywhere" }} />
                </FadeSpoiler>
            </Stack>
            <TodoItemControls isActive={hovered} setIsActive={setHovered} {...params} />
        </Table.Td>
    </Table.Tr>
}

type TodoItemControlsProps = TodoItemProps & {
    isActive: boolean,
    setIsActive: (active: boolean) => void,
}
const TodoItemControls = ({ isActive, setIsActive, todo, openEditTodo = () => { }, showInProgressToggle }: TodoItemControlsProps) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)
    const updateTodoWithNavigate = useUpdateTodoWithNavigate()
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
        updateTodoWithNavigate(todo, {remindMeAt})
    }, [todo, updateTodoWithNavigate])

    return (
        <Transition transition="fade" duration={250} mounted={isActive || keepActiveCounter > 0}>
            {(styles) => (
                <Paper style={styles} pos="absolute" top={0}
                    right={0} radius="md" withBorder p="xs" mt="1rem" mr="1rem">
                    <Group>
                        <TooltipActionIcon tooltip={isCompleted ? "Uncomplete" : "Complete"} variant="light" size="sm" onClick={e => {
                            updateTodoWithNavigate(todo, {
                                completedAt: isCompleted ? undefined : dayjs(),
                                inProgress: false,
                            })
                        }}>{isCompleted ? <ArrowUUpLeftIcon /> : <CheckIcon />}</TooltipActionIcon>
                        {(!isCompleted && showInProgressToggle) && <TooltipActionIcon tooltip={!todo.inProgress ? "Mark in progress" : "Mark not in progress"} size="sm" variant="subtle" onClick={async () => {
                            const todoUpdates: Partial<TodoData> = {
                                inProgress: !todo.inProgress
                            }
                            
                            //if we are going in progress and we have a reminder in the past, clear the reminder
                            if (todoUpdates.inProgress && todo.remindMeAt?.isBefore(dayjs())) {
                                todoUpdates.remindMeAt = undefined
                            }
                            const didNavigate = await updateTodoWithNavigate(todo, todoUpdates)
                            if(didNavigate) {
                                setIsActive(false)
                            }
                        }}>{todo.inProgress ? <LightningSlashIcon /> : <LightningIcon />}</TooltipActionIcon>}
                        {!isCompleted && <SetReminderMenu onChange={updateKeepActive} currentReminder={todo.remindMeAt} onSetReminder={setReminder} showClearReminder={!!todo.remindMeAt}><TooltipActionIcon tooltip="Set reminder" size="sm" variant="subtle"><ClockIcon /></TooltipActionIcon></SetReminderMenu>}
                        {isCompleted && <TooltipActionIcon tooltip="Delete" size="sm" variant="subtle" color="red" onClick={() => todos.deleteTodo(todo)}><TrashIcon /></TooltipActionIcon>}
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

type TodoListProps = {
    completed?: boolean,
    todoItemParams?: Partial<TodoItemProps>,
    viewportRef?: React.RefObject<HTMLDivElement | null>,
    highlightedId?: string | null,
}
const TodoList = ({ completed = false, viewportRef, highlightedId, todoItemParams = {} }: TodoListProps) => {
    const todos = useTodos(completed)
    const items: TodoListItem[] = todos.todos.map((todo, index) => ({ index, ...todo }))
    const hasInProgress = items.length > 0 ? !!items[0].inProgress : false

    return (
        <Table.ScrollContainer minWidth={0} style={{ flex: 1 }} scrollAreaProps={{ viewportRef }}>
            <Table verticalSpacing="lg" horizontalSpacing="md">
                <Table.Tbody>
                    {items.map((todo) => <TodoItem key={todo.id} id={`todo-${todo.id}`} todo={todo} isHighlighted={todo.id === highlightedId} showInProgressToggle={!hasInProgress || !!todo.inProgress} {...todoItemParams} />)}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    )
}

type InProgressProps = {
    openEditTodo: (todo?: TodoListItem) => void,
}
const InProgress = ({ openEditTodo }: InProgressProps) => {
    const todos = useTodos()

    // State for active highlight + ref to manage timer cleanup
    const highlightedId = useTodoNavigationStore((s) => s.targetTodoId)
    const clearHighlightedId = useTodoNavigationStore((s) => s.clearTargetTodo)
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const scrollToItem = (id: string) => {
        console.log("Window scroll position:", window.scrollY)
        const element = document.getElementById(`todo-${id}`);
        const viewport = viewportRef.current;

        if (element && viewport) {
            const elRect = element.getBoundingClientRect();
            const vpRect = viewport.getBoundingClientRect();

            const isFullyVisible =
                elRect.top >= vpRect.top - 1 &&
                elRect.bottom <= vpRect.bottom + 1;

            if (!isFullyVisible) {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }


        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => {
            console.log("Clearing highlighted id", highlightedId)
            clearHighlightedId()
        }, 1000);
    };

    useEffect(() => {
        if (!highlightedId || todos.isLoading) {
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
    }, [highlightedId, highlightTimer, todos.isLoading])
    
    return (
        <>
            <TodoList viewportRef={viewportRef} highlightedId={highlightedId} todoItemParams={{
                openEditTodo: openEditTodo,
            }} />
        </>
    )
}

const TOTAL_CLEAN_THRESHOLD = 100
const CLEAN_THRESHOLD = 30
const Completed = () => {
    const cleanDate = dayjs().add(-30, "day")
    const todos = useTodos(true)
    const [showCleanAlert, setShowCleanAlert] = useState(todos.todos.length > TOTAL_CLEAN_THRESHOLD && todos.todos[todos.todos.length-CLEAN_THRESHOLD].completedAt?.isBefore(cleanDate))
    const cleanAlertColor = "gray"

    const cleanCount = showCleanAlert ? todos.todos.length-1-todos.todos?.findLastIndex((todo) => todo.completedAt?.isAfter(cleanDate)) : 0

    return (<Flex gap={0} justify="flex-start" direction="column" style={{flex: 1, minHeight: 0}}>
        {showCleanAlert && <Alert withCloseButton color={cleanAlertColor} m="xs" title="Clean up old todos?" icon={<QuestionIcon />} onClose={() => setShowCleanAlert(false)}>
            <Stack>
            <Text>There are {cleanCount} todos completed over {cleanDate.fromNow()}. Delete old completed todos?</Text>
            <Button color={cleanAlertColor} onClick={() => {
                todos.cleanTodos(cleanDate)
                setShowCleanAlert(false)
            }}>Clean old todos</Button>
            </Stack>
        </Alert>}
        <TodoList completed={true} />
        </Flex>
    )
}

export const Todos = () => {
    const [todoToEdit, setTodoToEdit] = useState<TodoListItem | undefined>(undefined)
    const [addTodoOpened, { open: openAddTodoModal, close: closeAddTodo }] = useDisclosure(false)
    const todos = useTodos()
    const activeTab = useTodoNavigationStore((s) => s.activeTab)
    const setActiveTab = useTodoNavigationStore((s) => s.setActiveTab)

    const openAddEditTodo = useCallback((todo?: TodoListItem) => {
        setTodoToEdit(todo)
        openAddTodoModal()
    }, [openAddTodoModal, setTodoToEdit])


    return (
        <DefaultErrorBoundary>
            <TickerProvider>
                {/* Root container fills entire window height and prevents global window scrolling */}
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