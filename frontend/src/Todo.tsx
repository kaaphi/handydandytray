import { ActionIcon, Box, Button, Divider, Flex, Group, Menu, Modal, Overlay, Paper, ScrollArea, Stack, Table, Tabs, Text, Textarea, Transition, Typography } from "@mantine/core"
import { convertTodoToGo, Todo, useTodos } from "./hooks/useTodos"
import { useDisclosure, useHover } from "@mantine/hooks"
import { useForm } from "@mantine/form"
import { marked } from "marked"
import { useCallback, useRef, useState } from "react"
import { ArrowUUpLeftIcon, CheckIcon, ClockIcon, DotsThreeIcon, PencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { DateInput, DatePickerInput, getTimeRange, TimePicker } from "@mantine/dates"
import dayjs, { Dayjs } from "dayjs"
import { UIService } from "../bindings/handydandytray"
import { RelativeTime } from "./lib/dayjs"

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
        <Textarea data-autofocus placeholder="description" key={form.key("description")} {...form.getInputProps("description", { type: "input" })} onPaste={handlePaste} ref={textareaRef} />
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
}

const TodoItem = ({ todo, editReminder = () => { }, openEditTodo = () => { } }: TodoItemParams) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)
    const { hovered, ref } = useHover();
    const [ menuOpened, setMenuOpened ] = useState(false)

    return <Table.Tr pos="relative" ref={ref} >

        <Table.Td>            
            <Stack>
                <Stack gap="xs">
                {todo.createdAt && <Text c="dimmed" size="xs">Created: {dayjs(todo.createdAt).format("YYYY-MM-DD")}</Text>}
                {todo.dueAt && <Text c="dimmed" size="xs">Due: {dayjs(todo.dueAt).format("YYYY-MM-DD")}</Text>}
                {todo.remindMeAt && <Text c="dimmed" size="xs">Remind me: <RelativeTime time={todo.remindMeAt} /></Text>}
                {todo.completedAt && <Text c="dimmed" size="xs">Completed: {dayjs(todo.completedAt).format()}</Text>}
                </Stack>
                <Text>
                    <Typography>
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
                    </Typography>
                </Text>
            </Stack>

            <Transition transition="fade" duration={250} mounted={hovered || menuOpened}>
                {(styles) => (
                    <Overlay
                        style={styles}
                        color="white"
                        backgroundOpacity={0}
                        blur={0}
                        zIndex={10}
                        radius="md"
                    >
                        
                        <Flex justify="end" align="start">
                            <Paper shadow="sm" radius="md" withBorder p="xs" mt="1rem" mr="1rem">
                                <Group>
                <ActionIcon variant="light" size="sm" onClick={e => {
                    todo.completedAt = isCompleted ? undefined : dayjs()
                    todos.updateTodo(todo)
                }}>{isCompleted ? <ArrowUUpLeftIcon /> : <CheckIcon />}</ActionIcon>
                {!isCompleted && <ActionIcon size="sm" variant="outline" onClick={() => editReminder(todo)}><ClockIcon /></ActionIcon>}
                {isCompleted && <ActionIcon size="sm" variant="subtle" color="red" onClick={() => todos.deleteTodo(todo)}><TrashIcon /></ActionIcon>}
                {!isCompleted && <Menu onChange={setMenuOpened}>
                    <Menu.Target>
                        <ActionIcon size="sm" variant="subtle"><DotsThreeIcon /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => openEditTodo(todo)} leftSection={<PencilIcon />}>Edit</Menu.Item>
                        <Menu.Divider />
                        <Menu.Item onClick={() => todos.deleteTodo(todo)} color="red" leftSection={<TrashIcon />}>Remove</Menu.Item>
                        {import.meta.env.DEV && <Menu.Item onClick={() => UIService.ShowTodoReminder(convertTodoToGo(todo))}>Test Reminder</Menu.Item>}
                    </Menu.Dropdown>
                </Menu>}
                </Group>
                </Paper>
            </Flex>
                    </Overlay>
                )}
            </Transition>
        </Table.Td>
    </Table.Tr>
}

type TodoListParams = {
    completed?: boolean,
    todoItemParams?: Partial<TodoItemParams>
}

const TodoList = ({completed=false, todoItemParams={}} : TodoListParams) => {
       const todos = useTodos(completed)

    return (
        <ScrollArea style={{ flex: 1 }}>
            <Table verticalSpacing="lg" horizontalSpacing="md">
                {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo} {...todoItemParams} />)}
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
            }} />
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
                    <ActionIcon disabled={todos.isLoading} onClick={() => openAddEditTodo()} ><PlusIcon size={32} /></ActionIcon>
                </Flex>
                <Tabs.Panel value="inProgress" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <InProgress openEditTodo={openAddEditTodo} />
                </Tabs.Panel>

                <Tabs.Panel value="completed" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Completed />
                </Tabs.Panel>
            </Tabs>
        </Box>
    )
}
