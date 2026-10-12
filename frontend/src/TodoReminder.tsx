import { CloseButton, Group, Paper, Space, Text } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import { UIService } from "../bindings/handydandytray";
import { useNavigate, useParams } from "react-router";
import { useTodo } from "./hooks/useTodos";
import { useEffect } from "react";
import { marked } from "marked";
import PawIcon from './assets/paw-icon.svg?react';
import { AutoResizeContainer } from "./lib/AutoResizeContainer";

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
            <AutoResizeContainer>
            <Paper
                h="fit-content"
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
                    if (todo.data?.id) {
                        Events.Emit("todo:reminderClicked", todo.data.id);
                    }
                }}
            >
                <Group align="center" mb="xs" style={{ flexShrink: 0 }}>
                    <PawIcon width={16} height={16}/>
                    <Text fw={600} size="sm" c="dimmed">
                        Handy Dandy Reminder
                    </Text>
                    <Space style={{ flex: 1 }} />
                    <CloseButton onClick={() => UIService.HideTodoReminder()} size="sm" aria-label="Close window" />
                </Group>
                <Text lineClamp={3}>{getPlainTextFromMarkdown(todo.data!.description)}</Text>
            </Paper>
            </AutoResizeContainer>
        )
    }
}