import { ActionIcon, Box, Button, Card, Divider, Flex, Group, Menu, Modal, ScrollArea, Space, Stack, Tabs, Text, Textarea, Typography } from "@mantine/core"
import { Todo, UseTodos, useTodos } from "./hooks/useTodos"
import { useDisclosure } from "@mantine/hooks"
import { useForm } from "@mantine/form"
import { marked } from "marked"
import { useRef, useState } from "react"
import { ArrowUUpLeftIcon, CheckIcon, ClockIcon, DotsThreeIcon, PencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { DateInput, DatePickerInput, getTimeRange, TimePicker } from "@mantine/dates"
import dayjs, { Dayjs } from "dayjs"
import weekday from 'dayjs/plugin/weekday'
import isToday from 'dayjs/plugin/isToday'

dayjs.extend(weekday);
dayjs.extend(isToday);


const convertLinkUrl = (url: string): string => {
    if (url.startsWith("https://teams.live.com") || url.startsWith("https://teams.microsoft.com")) {
        //replace https:// with msteams://
        return "msteams://" + url.slice(8)
    } else {
        return url;
    }
}

const AddTodo = ({ todos, close }: { todos: UseTodos, close: () => void }) => {
    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            description: "",
            dueAt: undefined,
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
        console.log(values)
        todos.createTodo(values)
        close()
    })}>
        <Textarea data-autofocus placeholder="description" key={form.key("description")} {...form.getInputProps("description", { type: "input" })} onPaste={handlePaste} ref={textareaRef} />
        <DateInput key={form.key("dueAt")} placeholder="Due Date" presets={[
            { value: dayjs().add(1, 'day').format('YYYY-MM-DD'), label: 'Tomorrow' },
            { value: dayjs().startOf("week").add(1, "week").weekday(1).format('YYYY-MM-DD'), label: 'Next Monday' },
        ]} highlightToday clearable {...form.getInputProps("dueAt", { type: "input" })} />
        <Button type="submit">Add Todo</Button>
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
    editReminder?: (todo: Todo) => void
}

const TodoItem = ({ todo, editReminder = () => { } }: TodoItemParams) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)

    return <Card withBorder>
        
        <Card.Section style={{ flex: 1 }}>
            <Typography>
                <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
            </Typography>
            {todo.dueAt && <Text>Due: {dayjs(todo.dueAt).format("YYYY-MM-DD")}</Text>}
            {todo.remindMeAt && <Text>Remind me: {dayjs(todo.remindMeAt).format("YYYY-MM-DD HH:mm")}</Text>}
            {todo.completedAt && <Text>Completed: {dayjs(todo.dueAt).format()}</Text>}
        </Card.Section>
        <Card.Section>
            <Group>
            <Button variant="light" leftSection={isCompleted ? <ArrowUUpLeftIcon size={14} /> : <CheckIcon size={14} />} h={32} onClick={e => {
                todo.completedAt = isCompleted ? undefined : dayjs()
                todos.updateTodo(todo)
            }}>{isCompleted ? "Move to In Progress" : "Complete"}</Button>
            {!isCompleted && <ActionIcon variant="outline" onClick={() => editReminder(todo)}><ClockIcon size={32} /></ActionIcon>}
                <Space style={{ flex: 1 }} />
                {isCompleted && <ActionIcon variant="subtle" color="red" onClick={() => todos.deleteTodo(todo)}><TrashIcon size={32} /></ActionIcon>}
                {!isCompleted && <Menu>
                    <Menu.Target>
                        <ActionIcon variant="subtle"><DotsThreeIcon size={32} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<PencilIcon size={14} />}>Edit</Menu.Item>
                        <Menu.Divider />
                        <Menu.Item onClick={() => todos.deleteTodo(todo)} color="red" leftSection={<TrashIcon size={14} />}>Remove</Menu.Item>
                    </Menu.Dropdown>
                </Menu>}
                </Group>
        </Card.Section>
    </Card>
}



const InProgress = () => {
    const todos = useTodos()
    const [editReminderTodo, setEditReminderTodo] = useState<Todo | null>(null)


    return (
        <>
            <Modal opened={!!editReminderTodo} onClose={() => setEditReminderTodo(null)} title="Remind Me">
                {editReminderTodo && <SetReminder todo={editReminderTodo} close={() => setEditReminderTodo(null)} />}
            </Modal>
            <ScrollArea style={{ flex: 1 }}>
                <Stack>
                    {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo} editReminder={setEditReminderTodo} />)}
                </Stack>
            </ScrollArea>
        </>
    )
}

const Completed = () => {
    const todos = useTodos(true)

    return (
        <ScrollArea style={{ flex: 1 }}>

            <Stack>
                {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
            </Stack>
        </ScrollArea>
    )
}

export const Todos = () => {
    const [addTodoOpened, { open: openAddTodo, close: closeAddTodo }] = useDisclosure(false)
    const todos = useTodos()

    return (
        // 1. Root container fills entire window height and prevents global window scrolling
        <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Modal opened={addTodoOpened} onClose={closeAddTodo} title="Add Todo">
                <AddTodo todos={todos} close={closeAddTodo} />
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
                    <ActionIcon disabled={todos.isLoading} onClick={openAddTodo} ><PlusIcon size={32} /></ActionIcon>
                </Flex>
                <Tabs.Panel value="inProgress" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <InProgress />
                </Tabs.Panel>

                <Tabs.Panel value="completed" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Completed />
                </Tabs.Panel>
            </Tabs>
        </Box>
    )
}
