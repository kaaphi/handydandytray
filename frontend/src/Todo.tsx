import { ActionIcon, Button, Card, Modal, Stack, Textarea, Typography } from "@mantine/core"
import { Todo, UseTodos, useTodos } from "./hooks/useTodos"
import { useDisclosure } from "@mantine/hooks"
import { useForm } from "@mantine/form"
import { marked } from "marked"
import { useRef } from "react"
import { CheckIcon, ClockIcon } from "@phosphor-icons/react"


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
        todos.createTodo(values.description)
        close()
    })}>
    <Textarea placeholder="description" key={form.key("description")} {...form.getInputProps("description", {type: "input"})} onPaste={handlePaste} ref={textareaRef}/>
    <Button type="submit">Add Todo</Button>
    </form>
}

const TodoItem = ({ todo }: { todo: Todo }) => {
    const todos = useTodos()

    return <Card withBorder>
        <Typography>
            <div dangerouslySetInnerHTML={{ __html: marked.parse(todo.description) }} />
        </Typography>
        <ActionIcon onClick={e => {
            todo.completedAt = new Date()
            todos.updateTodo(todo)
        }}><CheckIcon size={32} /></ActionIcon>
        <ActionIcon><ClockIcon size={32} /></ActionIcon>
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