import { Todos } from './Todo';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router';
import { EnterTime } from './EnterTime';
import { Notifications } from './Notifications';
import { HandyDandyTray } from './HandyDandyTray';
import { TimeTracking } from './TimeTracking';
import { queryClient } from './lib/queryClient';
import { theme } from './lib/theme';

export const App = () => {
  return (
    <MantineProvider theme={theme}>
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
