import { Button, Stack, Text } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import { UIService } from "../bindings/handydandytray";
import { useNavigate, useParams } from "react-router";
import { useTodo } from "./hooks/useTodos";
import { useEffect } from "react";

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
            <Stack>
                <Text>REMINDER! {todo.data!.description}</Text>
                <Button onClick={() => UIService.HideTodoReminder()}>Hide</Button>
            </Stack>
        )
    }
}