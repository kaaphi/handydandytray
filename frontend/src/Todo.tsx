import { ActionIcon, Button, Card, Code, Group, Modal, Stack, Text, Textarea, Typography } from "@mantine/core"
import { Todo, UseTodos, useTodos } from "./hooks/useTodos"
import { useDisclosure } from "@mantine/hooks"
import { useForm } from "@mantine/form"
import { marked } from "marked"
import { useRef } from "react"
import { CheckIcon, ClockIcon } from "@phosphor-icons/react"
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
        },
        transformValues: (values) => ({
            description: values.description,
            dueAt: values.dueAt ? new Date(values.dueAt) : undefined,
        })
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
    <Textarea placeholder="description" key={form.key("description")} {...form.getInputProps("description", {type: "input"})} onPaste={handlePaste} ref={textareaRef}/>
    <DateInput key={form.key("dueAt")} placeholder="Due Date"  presets={[
         { value: dayjs().add(1, 'day').format('YYYY-MM-DD'), label: 'Tomorrow' },
         { value: dayjs().startOf("week").add(1, "week").weekday(1).format('YYYY-MM-DD'), label: 'Next Monday' },
    ]} highlightToday clearable {...form.getInputProps("dueAt", {type: "input"})} />
    <Button type="submit">Add Todo</Button>
    </form>
}

const TodoItem = ({ todo }: { todo: Todo }) => {
    const todos = useTodos()

    return <Card withBorder>
        <Card.Section>
        <Typography>
            <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
        </Typography>
        {todo.dueAt ? <Text>{dayjs(todo.dueAt).format("YYYY-MM-DD")}</Text> : null}
        </Card.Section>
        <Card.Section>
        <Group>
        <ActionIcon onClick={e => {
            todo.completedAt = new Date()
            todos.updateTodo(todo)
        }}><CheckIcon size={32} /></ActionIcon>
        <ActionIcon><ClockIcon size={32} /></ActionIcon>
        <Button onClick={e => todos.deleteTodo(todo)}>DELETE</Button>
        </Group>
        </Card.Section>
    </Card>
}

export const Todos = () => {
    const [addTodoOpened, { open: openAddTodo, close: closeAddTodo}] = useDisclosure(false)
    const todos = useTodos()
    
    return (
        <>
            <Modal opened={addTodoOpened} onClose={closeAddTodo} title="Add Todo">
                <AddTodo todos={todos} close={closeAddTodo}/>
            </Modal>
            <Stack>
                {todos.todos.map((todo) => <TodoItem key={todo.id} todo={todo}/>)}
            </Stack>
            <Button disabled={todos.isLoading} onClick={openAddTodo} >Add one!</Button>
        </>
    )

}
