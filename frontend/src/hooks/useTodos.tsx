import { UseMutateAsyncFunction, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Todo as RawTodo, TodoData as RawTodoData, TodoService } from "../../bindings/handydandytray/internal/todo";
import { transformDatesFromGo, transformDatesToGo, WithDates } from "./dateAdapter";
import dayjs, { Dayjs } from "dayjs";

export type UseTodos = {
    todos: Todo[]
    isLoading: boolean
    error: Error | null
    createTodo: UseMutateAsyncFunction<void, Error, TodoData, unknown>
    deleteTodo: UseMutateAsyncFunction<void, Error, Todo, unknown>
    updateTodo: UseMutateAsyncFunction<void, Error, Todo, unknown>
}

export type Todo = WithDates<RawTodo, "completedAt" | "remindMeAt" | "createdAt">;

export type TodoData = WithDates<RawTodoData, "completedAt" | "remindMeAt">

export const convertTodoToGo = (todo: Todo): RawTodo => {
    return transformDatesToGo(todo, ["completedAt", "remindMeAt", "createdAt"])
}

export const convertTodoDataToGo = (todo: TodoData): RawTodoData => {
    return transformDatesToGo(todo, ["completedAt", "remindMeAt"])
}

export const convertTodoFromGo = (todo: RawTodo): Todo => {
    return transformDatesFromGo(todo, ["completedAt", "remindMeAt", "createdAt"])
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

type TodoSortDiffs = (number|undefined)[]
type TodoSortDetails = {
    /**
     * Array of raw sort diff millis from now for comparing
     */
    diff: TodoSortDiffs
    /**
     * Raw days from now
     */
    dayDiff: number
    /**
     * Sort order within a day
     */
    intraDaySort: number
}
const buildSortArray = ({dayDiff, intraDaySort, diff}:TodoSortDetails): TodoSortDiffs => 
    [dayDiff, intraDaySort, ...diff]    


/**
 * Determine the data used to sort the active Todo. If a todo has either a remind me or due date, we use that with the diff to now (i.e. sort overdue, then soon to be due, then due in the future).
 * Otherwise, we use the created at time with the diff from now (i.e. sort from most recently created to least recently created).
 * @param todo the Todo to calculate for
 * @param now the current time
 * @returns details for sorting
 */
const calculateActiveTodoSortOrder = (todo: Todo, now: Dayjs): TodoSortDetails => {
    const startOfDay = now.startOf("day")
    const remindMeAtDiff = todo.remindMeAt?.diff(now)
    const dueDate = todo.dueAt ? dayjs(todo.dueAt, "YYYY-MM-DD") : undefined
    const dueAtDiff = dueDate?.diff(now)
    const createdAtDiff = now.diff(todo.createdAt!)
    let min: TodoSortDetails|undefined = undefined
    if (todo.remindMeAt) {
        min = {
            diff: [remindMeAtDiff!, dueAtDiff, createdAtDiff],
            dayDiff: todo.remindMeAt!.startOf("day").diff(startOfDay, "day"),
            intraDaySort: 0
        }
    }
    if (todo.dueAt) {
        const dayDiff = dueDate!.diff(startOfDay, "day")
        if (!min || min.dayDiff > dayDiff) {
            min = {
                diff: [dueAtDiff, remindMeAtDiff, createdAtDiff],
                dayDiff: dayDiff,
                intraDaySort: 1
            }
        }
    }
    if (!min) {
        min = {
            diff: [createdAtDiff],
            dayDiff: startOfDay.diff(todo.createdAt!.startOf("day"), "day"),
            intraDaySort:2
        }
    }

    return min!
}

/**
 * Compare two active Todos for sorting. Sort priority: day diff, category of value (remind me first, then due date, finally created at), then raw diff.
 * @param a first item to compare
 * @param b second item to compare
 * @param now the current time
 * @returns a negative value if the first argument is less than the second argument, zero if they're equal, and a positive value otherwise
 */
const compareActiveTodoForSort = (a: Todo, b: Todo, now: Dayjs): number => {
    const aOrder = buildSortArray(calculateActiveTodoSortOrder(a, now))
    const bOrder = buildSortArray(calculateActiveTodoSortOrder(b, now))

    let result: number
    for(let i = 0; i < Math.min(aOrder.length, bOrder.length); i++) {
        result = (aOrder[i] ?? Number.MAX_SAFE_INTEGER) - (bOrder[i] ?? Number.MAX_SAFE_INTEGER)
        if (result != 0) {
            return result
        }
    }
    
    //everything matched, so just compare id for stable sort
    return a.id.localeCompare(b.id)
}

export const sortTodos = (todos: Todo[], now = dayjs()): Todo[] => {
    return [...todos].sort((a, b) => {
        return compareActiveTodoForSort(a, b, now);
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

            return rawTodos?.map((todo) => convertTodoFromGo(todo))
        },
        //Because only the Todo window is reading and modifying this data, we don't ever have to refresh the cache
        //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
        staleTime: Infinity
    });

    // Mutation for updating data
    const createTodoMutation = useMutation({
        mutationFn: (todo: TodoData) => TodoService.AddTodo(convertTodoDataToGo(todo)),
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

export const _testInternals = {
    calculateActiveTodoSortOrder,
    compareActiveTodoForSort,
}