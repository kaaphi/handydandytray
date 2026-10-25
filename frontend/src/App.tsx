import { useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import { Todos } from './Todo';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router';
import { useTodoNavigationStore } from './hooks/useTodoNavigationStore';
import { EnterTime } from './EnterTime';
import { Notifications } from './Notifications';
import { HandyDandyTray } from './HandyDandyTray';
import { TimeTracking } from './TimeTracking';

export const App = () => {
  const queryClient = new QueryClient()

  const navigateToTodo = useTodoNavigationStore((s) => s.navigateToTodo)

  useEffect(() => {
    const unsubscribe = Events.On('todo:reminderClicked', (event) => {
      const todoId = event.data as string;
      console.log("Got event! Scrolling to active todo", todoId)
      if (todoId) {
        //We'll have to do more "stuff" here later if we have more than one app that we navigate between in the main window
        navigateToTodo(todoId)
      }
    });

    return () => {
      unsubscribe(); // Clean up listener on unmount
    };
  }, [])

  return (
    <MantineProvider>
      <DatesProvider settings={{ firstDayOfWeek: 0 }}>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <Routes>
              <Route path="/" element={<HandyDandyTray />}>
                <Route path="/todos" element={<Todos />} />
                <Route path="/timeTracking" element={<TimeTracking />}/>
              </Route>
              <Route path="/enterTime" element={<EnterTime />} />
              <Route path="/notifications" element={<Notifications />} />
            </Routes>
          </HashRouter>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  )
}
