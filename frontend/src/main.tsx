import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatesProvider } from '@mantine/dates';

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider>
      <DatesProvider settings={{firstDayOfWeek: 0}}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
)
