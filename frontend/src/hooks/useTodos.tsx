import { UseMutateAsyncFunction, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Todo as RawTodo, TodoService } from "../../bindings/handydandytray";
import { v7 as uuidv7 } from 'uuid';
import { transformDatesFromGo, transformDatesToGo, WithDates } from "./dateAdapter";

export type UseTodos = {
    todos: Todo[]
    isLoading: boolean
    error: Error | null
    createTodo: UseMutateAsyncFunction<void, Error, NewTodo, unknown>
    deleteTodo: UseMutateAsyncFunction<void, Error, Todo, unknown>
    updateTodo: UseMutateAsyncFunction<void, Error, Todo, unknown>
}

export type Todo = WithDates<RawTodo, "completedAt" | "remindMeAt">;

export type NewTodo = Omit<Todo, "id">

export const convertTodoToGo = (todo: Todo): RawTodo => {
    return transformDatesToGo(todo, ["completedAt", "remindMeAt"])
}

export const convertTodoFromGo = (todo: RawTodo): Todo => {
    return transformDatesFromGo(todo, ["completedAt", "remindMeAt"])
}

export const useTodo = (id?: string) => {
    return useQuery({
        queryKey: ['todos', id],         // Re-runs automatically when `id` changes
        queryFn: () => TodoService.GetTodo(id!),
        staleTime: 0,                   // Data is immediately stale
        refetchOnMount: "always",       // Always re-query Go on mount
        enabled: !!id
    });
}

export const useTodos = (completedTodos: boolean = false): UseTodos => {
    const queryClient = useQueryClient();

    const queryKey =['todos',  completedTodos ? 'completed' : 'active']
    const queryFunction = completedTodos ? () => TodoService.GetCompletedTodos() : () => TodoService.GetActiveTodos()

    // Query for reading data
    const todosQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const rawTodos = await queryFunction()

            return rawTodos?.map((todo) => transformDatesFromGo(todo, ["completedAt", "remindMeAt"]))
        },
        //Because only the Todo window is reading and modifying this data, we don't ever have to refresh the cache
        //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
        staleTime: Infinity
    });

    // Mutation for updating data
    const createTodoMutation = useMutation({
        mutationFn: (todo: NewTodo) => TodoService.AddTodo(convertTodoToGo({
            id: uuidv7(),
            ...todo
        })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKey });
        },
    });


    const deleteTodoMutation = useMutation({
        mutationFn: (todo: Todo) => TodoService.DeleteTodo(convertTodoToGo(todo)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey:queryKey });
        },
    })

    const updateTodoMutation = useMutation({
        mutationFn: (todo: Todo) => TodoService.UpdateTodo(convertTodoToGo(todo)),
        onSuccess: () => {
            // TODO improve this to use current data to know whether we are changing the completion date to move from active to completed or vice-versa
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    })

    return {
        todos: todosQuery.data ?? [],
        isLoading: todosQuery.isLoading || createTodoMutation.isPending || deleteTodoMutation.isPending,
        error: todosQuery.error ?? createTodoMutation.error,
        createTodo: createTodoMutation.mutateAsync,
        deleteTodo: deleteTodoMutation.mutateAsync,
        updateTodo: updateTodoMutation.mutateAsync,
    };
}