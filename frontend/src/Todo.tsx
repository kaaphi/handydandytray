import { ActionIcon, Box, Button, Card, Group, Modal, Paper, ScrollArea, Stack, Tabs, Text, Textarea, Title, Typography } from "@mantine/core"
import { Todo, UseTodos, useTodos } from "./hooks/useTodos"
import { useDisclosure } from "@mantine/hooks"
import { useForm } from "@mantine/form"
import { marked } from "marked"
import { useRef } from "react"
import { ArrowUDownLeftIcon, CheckIcon, ClockIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { DateInput } from "@mantine/dates"
import dayjs from "dayjs"
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

const AddTodo = ({todos, close} : {todos: UseTodos, close: () => void}) => {
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
    <Textarea data-autofocus placeholder="description" key={form.key("description")} {...form.getInputProps("description", {type: "input"})} onPaste={handlePaste} ref={textareaRef}/>
    <DateInput key={form.key("dueAt")} placeholder="Due Date"  presets={[
         { value: dayjs().add(1, 'day').format('YYYY-MM-DD'), label: 'Tomorrow' },
         { value: dayjs().startOf("week").add(1, "week").weekday(1).format('YYYY-MM-DD'), label: 'Next Monday' },
    ]} highlightToday clearable {...form.getInputProps("dueAt", {type: "input"})} />
    <Button type="submit">Add Todo</Button>
    </form>
}

const TodoItem = ({ todo }: { todo: Todo }) => {
    const isCompleted = !!todo.completedAt
    const todos = useTodos(isCompleted)

    return <Card withBorder>
        <Card.Section>
            <Typography>
                <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
            </Typography>
            {todo.dueAt && <Text>Due: {dayjs(todo.dueAt).format("YYYY-MM-DD")}</Text>}
            {todo.completedAt && <Text>Completed: {dayjs(todo.dueAt).format()}</Text>}
        </Card.Section>
        {!isCompleted && <Card.Section>
            <Group>
                <ActionIcon onClick={e => {
                    todo.completedAt = dayjs()
                    todos.updateTodo(todo)
                }}><CheckIcon size={32} /></ActionIcon>
                <ActionIcon><ClockIcon size={32} /></ActionIcon>
                <ActionIcon onClick={e => todos.deleteTodo(todo)}><TrashIcon size={32} /></ActionIcon>
            </Group>
        </Card.Section>
        }
        {isCompleted && <Card.Section>
            <Group>
                <ActionIcon onClick={e => {
                    todo.completedAt = undefined
                    todos.updateTodo(todo)
                }}><ArrowUDownLeftIcon size={32} /></ActionIcon>
                <ActionIcon onClick={e => todos.deleteTodo(todo)}><TrashIcon size={32} /></ActionIcon>
            </Group>
        </Card.Section>
        }
    </Card>
}



const InProgress = () => {
    const [addTodoOpened, { open: openAddTodo, close: closeAddTodo}] = useDisclosure(false)
    const todos = useTodos()
    
    return (
        <>
            <Modal opened={addTodoOpened} onClose={closeAddTodo} title="Add Todo">
                <AddTodo todos={todos} close={closeAddTodo} />
            </Modal>
            <ScrollArea style={{ flex: 1 }}>
                <Stack>
                    {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
                </Stack>
            </ScrollArea>
            <Box style={{ flexShrink: 0, borderRadius: 0 }}>
                <ActionIcon disabled={todos.isLoading} onClick={openAddTodo} ><PlusIcon size={32} /></ActionIcon>
            </Box>
        </>
    )
}

const Completed = () => {
    const todos = useTodos(true)
    
    return (
         <ScrollArea style={{ flex: 1 }}>
            
            <Stack>
                {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo}/>)}
            </Stack>
        </ScrollArea>
    )
}

export const Todos = () => {
    return  (
    // 1. Root container fills entire window height and prevents global window scrolling
    <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <Tabs defaultValue="inProgress" keepMounted={false} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Tabs.List style={{ flexShrink: 0 }}>
            <Tabs.Tab value="inProgress">
                In Progress
            </Tabs.Tab>
            <Tabs.Tab value="completed">
                Completed
            </Tabs.Tab>

        </Tabs.List>
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
