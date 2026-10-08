import { CloseButton, Group, Paper, Text } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import { UIService } from "../bindings/handydandytray";
import { useNavigate, useParams } from "react-router";
import { useTodo } from "./hooks/useTodos";
import { useEffect } from "react";
import { marked } from "marked";

const getPlainTextFromMarkdown = (markdown: string): string => {
    const rawHtml = marked.parse(markdown, { async: false }) as string;

    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    return doc.body.textContent || '';
}

export const TodoReminder = () => {
    const params = useParams();
    const todo = useTodo(params.todoId)

    const navigate = useNavigate();

    useEffect(() => {
        // Listen for route changes emitted from Go
        const unsubscribe = Events.On('todo:reminder', (event) => {
            const todoId = event.data as string;
            console.log("Navigating to Todo", todoId)
            if (todoId) {
                navigate(`/todoReminder/${todoId}`);
            }
        });

        return () => {
            unsubscribe(); // Clean up listener on unmount
        };
    }, [navigate]);

    if (todo.isPending) {
        return <></>
    } else {
        return (
            <Paper
                h="100vh"
                w="100vw"
                radius={0}
                shadow="none"
                p="md"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                }}
                onClick={() => {
                    UIService.HideTodoReminder()
                    UIService.OpenTodosWindow()
                }}
            >
                <Group justify="space-between" align="center" mb="xs" style={{ flexShrink: 0 }}>
                    <Text fw={600} size="sm" c="dimmed">
                        Handy Dandy Reminder
                    </Text>
                    <CloseButton onClick={() => UIService.HideTodoReminder()} size="sm" aria-label="Close window" />
                </Group>
                <Text truncate="end">{getPlainTextFromMarkdown(todo.data!.description)}</Text>
            </Paper>
        )
    }
}