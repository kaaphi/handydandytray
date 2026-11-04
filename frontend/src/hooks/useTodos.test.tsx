import { describe, it, expect } from 'vitest';
import { sortTodos, Todo, _testInternals } from './useTodos';
import dayjs from 'dayjs';

type SortTodo = {
    createdAt: string
    dueAt?: string
    remindMeAt?: string
} & Partial<Omit<Todo, "createdAt" | "dueAt" | "remindMeAt">>

const shuffle = <T,>(array: T[]): T[] => {
    // Create a shallow copy to avoid mutating the original array
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));

        // Swap elements
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

const makeTestTodo = ({ createdAt, remindMeAt, ...input }: SortTodo) => ({
    id: crypto.randomUUID(),
    description: "test todo",
    createdAt: dayjs(createdAt),
    remindMeAt: remindMeAt ? dayjs(remindMeAt) : undefined,
    ...input,
})

const makeTestTodos = (todos: SortTodo[]): Todo[] => {
    return todos.map((input, idx) => makeTestTodo({
        ...input,
        description: `test todo ${idx}`,
    }))
}

type SortCase = {
    name: string,
    todos: SortTodo[]
}

const now = dayjs("2026-10-31 12:00")
const sortCases: SortCase[] = [
    { name: "Empty", todos: [] },
    {
        name: "One", todos: [
            { createdAt: "2026-10-31 11:30" },
        ]
    },
    {
        name: "Only created", todos: [
            { createdAt: "2026-10-31 11:30" },
            { createdAt: "2026-10-31 11:25" },
            { createdAt: "2026-10-30 11:30" },
        ]
    },
    {
        name: "Only by remindMeAt", todos: [
            { createdAt: "2026-10-30 11:25", remindMeAt: "2026-10-31 10:00" },
            { createdAt: "2026-10-30 11:30", remindMeAt: "2026-11-01 10:00" },
            { createdAt: "2026-10-30 11:35", remindMeAt: "2026-11-11 10:00" },
        ]
    },
    {
        name: "Only by dueAt", todos: [
            { createdAt: "2026-10-30 11:25", dueAt: "2026-10-31" },
            { createdAt: "2026-10-30 11:30", dueAt: "2026-11-01" },
            { createdAt: "2026-10-30 11:35", dueAt: "2026-11-11" },
        ]
    },
    {
        name: "Mix createdAt, remindMeAt, dueAt all 0 dayDiff", todos: [
            //0 day diff
            { createdAt: "2026-10-30 11:25", remindMeAt: "2026-10-31 10:00" },
            { createdAt: "2026-10-30 11:35", remindMeAt: "2026-10-31 12:15" },
            { createdAt: "2026-10-30 11:35", dueAt: "2026-10-31" },
            { createdAt: "2026-10-30 11:25", dueAt: "2026-10-31" },
            { createdAt: "2026-10-31 11:59" },
            { createdAt: "2026-10-31 11:30" },
        ]
    },
    {
        name: "Mix createdAt, remindMeAt, dueAt multiple dayDiff", todos: [
            //-1 day diff
            { createdAt: "2026-10-25 11:35", dueAt: "2026-10-26" },            
            { createdAt: "2026-10-26 11:25", remindMeAt: "2026-10-30 10:00" },
            { createdAt: "2026-10-27 11:35", remindMeAt: "2026-10-30 12:15" },
            //0 day diff
            { createdAt: "2026-10-30 11:25", remindMeAt: "2026-10-31 10:00" },
            { createdAt: "2026-10-30 11:35", remindMeAt: "2026-10-31 12:15" },
            { createdAt: "2026-10-30 11:35", dueAt: "2026-10-31" },
            { createdAt: "2026-10-30 11:25", dueAt: "2026-10-31" },
            { createdAt: "2026-10-31 11:59" },
            { createdAt: "2026-10-31 11:30" },
            //1 day diff
            { createdAt: "2026-10-31 11:59", remindMeAt: "2026-11-1 12:00" },
            { createdAt: "2026-10-31 11:59", dueAt: "2026-11-1" },
            { createdAt: "2026-10-30 11:30" },
            //2 day diff
            { createdAt: "2026-10-29 11:30" },
            //3 day diff
            { createdAt: "2026-10-31 11:59", dueAt: "2026-11-3" },
        ]
    },
]

describe.for(sortCases)("sort $name", ({ todos }) => {
    const input = makeTestTodos(todos)

    it("already sorted", () => {
        const result = sortTodos(input, now)
        expect(result).toEqual(input)
        for (let i = 1; i < input.length; i++) {
            expect(_testInternals.compareActiveTodoForSort(input[i - 1], input[i], now)).toBeLessThan(0)
        }
    })

    describe("fuzz", () => {
        for (let i = 0; i < 5; i++) {
            it(`shuffled ${i + 1}`, () => {
                const result = sortTodos(shuffle(input), now)
                expect(result).toEqual(input)
                for (let i = 1; i < input.length; i++) {
                    expect(_testInternals.compareActiveTodoForSort(input[i - 1], input[i], now)).toBeLessThan(0)
                }
            })
        }
    })
})

type DayDiffCase = {
    todo: SortTodo,
    expected: number,
}

type TodoCompareCase = {
    name: string,
    input: [SortTodo, SortTodo]
    expected?: ("<" | "=" | ">"), //will default to a < b
}

describe("todo sort calculations", () => {
    it.for([
        { todo: { createdAt: "2026-10-29 1:30" }, expected: 2 },
        { todo: { createdAt: "2026-10-29 23:59" }, expected: 2 },
        { todo: { createdAt: "2026-10-29 00:00" }, expected: 2 },
        { todo: { createdAt: "2026-10-30 1:30" }, expected: 1 },
        { todo: { createdAt: "2026-10-30 23:59" }, expected: 1 },
        { todo: { createdAt: "2026-10-30 00:00" }, expected: 1 },
        { todo: { createdAt: "2026-10-31 00:00" }, expected: 0 },
        { todo: { remindMeAt: "2026-11-2 1:30" }, expected: 2 },
        { todo: { remindMeAt: "2026-11-2 23:59" }, expected: 2 },
        { todo: { remindMeAt: "2026-11-2 00:00" }, expected: 2 },
        { todo: { remindMeAt: "2026-11-1 1:30" }, expected: 1 },
        { todo: { remindMeAt: "2026-11-1 23:59" }, expected: 1 },
        { todo: { remindMeAt: "2026-11-1 00:00" }, expected: 1 },
        { todo: { remindMeAt: "2026-11-1 1:30" }, expected: 1 },
        { todo: { remindMeAt: "2026-11-1 23:59" }, expected: 1 },
        { todo: { remindMeAt: "2026-11-1 00:00" }, expected: 1 },
        { todo: { remindMeAt: "2026-10-31 1:30" }, expected: 0 },
        { todo: { remindMeAt: "2026-10-31 00:00" }, expected: 0 },
        { todo: { remindMeAt: "2026-10-31 23:59" }, expected: 0 },
        { todo: { remindMeAt: "2026-10-30 1:30" }, expected: -1 },
        { todo: { remindMeAt: "2026-10-30 00:00" }, expected: -1 },
        { todo: { remindMeAt: "2026-10-30 23:59" }, expected: -1 },
        { todo: { dueAt: "2026-10-30" }, expected: -1 },
        { todo: { dueAt: "2026-10-31" }, expected: 0 },
        { todo: { dueAt: "2026-11-1" }, expected: 1 },
        { todo: { dueAt: "2026-11-2" }, expected: 2 },
    ] as DayDiffCase[])("test dayDiff $todo is $expected", ({ todo, expected }: DayDiffCase) => {
        const result = _testInternals.calculateActiveTodoSortOrder(makeTestTodo(todo), now)
        expect(result.dayDiff).toBe(expected)
    })

    it.for([
        {
            name: "remindMeAt used for compare",
            input: [
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-3", createdAt: "2026-10-30 10:00" },
                { remindMeAt: "2026-10-31 13:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:01" },
            ],
        },
        {
            name: "equal(remindMeAt) dueAt used for compare",
            input: [
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00" },
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-3", createdAt: "2026-10-30 10:01" },
            ],
        },
        {
            name: "equal(remindMeAt,dueAt) createdAt used for compare",
            input: [
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:01" },
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00" },
            ],
        },
        {
            name: "equal(remindMeAt,dueAt,createdAt) id used for compare",
            input: [
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00", "id": "a" },
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00", "id": "b" },
            ],
        },
        {
            name: "equal",
            input: [
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00", "id": "a" },
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-12-1", createdAt: "2026-10-30 10:00", "id": "a" },
            ],
            expected: "=",
        },
        {
            name: "remindMeAt beats dueAt on same day",
            input: [
                { remindMeAt: "2026-10-31 8:30", dueAt: "2026-10-31", createdAt: "2026-10-30 9:00" },
                { remindMeAt: "2026-10-31 9:30", dueAt: "2026-10-31", createdAt: "2026-10-30 10:00" },
            ],
        },
        
    ] as TodoCompareCase[])("$name", ({input : [a,b],expected = "<"}: TodoCompareCase) => {
        const result = _testInternals.compareActiveTodoForSort(makeTestTodo(a), makeTestTodo(b), now)

        switch (expected) {
            case '<':
                expect(result).toBeLessThan(0)
                break;
            case '=':
                expect(result).toBe(0)
                break;
            case '>':
                expect(result).toBeGreaterThan(0)
                break;
        }
    })
})