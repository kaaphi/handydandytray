import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatesProvider } from '@mantine/dates';
import { HashRouter, Route, Routes } from 'react-router';
import { Todos } from './Todo';
import { TodoReminder } from './TodoReminder';

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider>
      <DatesProvider settings={{firstDayOfWeek: 0}}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/todoReminder" element={<TodoReminder />} />
            <Route path="/todoReminder/:todoId" element={<TodoReminder />} />
          </Routes>
        </HashRouter>
      </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
)

