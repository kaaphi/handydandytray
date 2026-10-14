import { create } from 'zustand'

export const TodoTab = {
  inProgress: "inProgress",
  completed: "completed",
} as const

export type TodoTab = (typeof TodoTab)[keyof typeof TodoTab]

export const isTodoTab = (value: string | null): value is TodoTab => {
  return Object.values(TodoTab).includes(value as TodoTab);
}

type TodoNavigationStore = {
    activeTab: TodoTab | null,
    targetTodoId: string | null,
    setActiveTab: (tab: TodoTab) => void,
    navigateToTodo: (todoId: string) => void,
    clearTargetTodo: () => void,
}

export const useTodoNavigationStore = create<TodoNavigationStore>((set) => ({
  activeTab: "inProgress",
  targetTodoId: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  navigateToTodo: (todoId) => set({ activeTab: "inProgress", targetTodoId: todoId }),
  clearTargetTodo: () => set({ targetTodoId: null }),
}));