import { ActionIcon, AppShell, Box, Menu, NavLink, NavLinkProps, Stack } from "@mantine/core";
import { BugIcon, ClockIcon, IconProps, ListChecksIcon, ListIcon } from "@phosphor-icons/react";
import { Outlet } from "react-router";
import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from 'react-router';
import { triggerNotification } from "./lib/notifications";
import { randomId } from "@mantine/hooks";
import { refreshConfig } from "./lib/config";
import { UIService } from "../bindings/handydandytray/internal/ui";
import { Events } from '@wailsio/runtime';
import { TimeTrackingService } from "../bindings/handydandytray/internal/timetracking";
import { ErrorBoundary } from "react-error-boundary";
import dayjs from "dayjs";
import { FallbackError } from "./FallbackError";

type NavItemProps = {
    icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
} 


const RouterNavItem = ({ icon: Icon, ...props }: NavItemProps & NavLinkProps & RouterNavLinkProps) => {
    return <NavLink {...props} component={RouterNavLink} ta="center" label={<Icon size="25" />} style={{ borderRadius: "5px" }} />
}

const BoxNavItem = ({ icon: Icon, ...props }: NavItemProps & NavLinkProps ) => {
    return <NavLink variant="light" {...props} component={Box} ta="center" label={<Icon size="25"/>} style={{ borderRadius: "5px" }} />
}

const NavBar = () => {
    
    
    return (
        <>
        <AppShell.Section grow>
            <Stack gap="xs" align="stretch">
                <ConfigMenu />
           <RouterNavItem icon={ListChecksIcon} description="Todos" to="/todos"/>
           <RouterNavItem icon={ClockIcon} description="Time Tracking" to="/timetracking"/>
           </Stack>
        </AppShell.Section>
        <AppShell.Section>
            <DevMenu />
        </AppShell.Section>
        </>
    )
}

const ConfigMenu = () => (
    <Menu offset={-10}>
        <Menu.Target>
            <ActionIcon variant="white" size="xs" color="black"><ListIcon /></ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
            <Menu.Item onClick={() => UIService.OpenEnterTimeWindow()}>Enter time now</Menu.Item>
            <Menu.Item onClick={() => {
                TimeTrackingService.UpdateDefaultBaselineForNextInterval(dayjs().toISOString())
                Events.Emit("timetracking:baselineUpdated")
            }}>Reset next interval start</Menu.Item>
            <Menu.Sub>
                <Menu.Sub.Target>
                    <Menu.Sub.Item>Config</Menu.Sub.Item>
                </Menu.Sub.Target>

                <Menu.Sub.Dropdown>
                    <Menu.Item onClick={refreshConfig}>Refresh config</Menu.Item>
                </Menu.Sub.Dropdown>
            </Menu.Sub>
        </Menu.Dropdown>
    </Menu>
)

const DevMenu = () => {
    if (import.meta.env.DEV) {
        return (
            
        <Menu>
            <Menu.Target>
                <BoxNavItem icon={BugIcon} />
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item onClick={() =>
                    triggerNotification({
                        type: "text",
                        props: {
                            title: `Text Notification ${randomId()}`,
                            text: randomId()
                        }
                    })
                }>Trigger Text Notification</Menu.Item>
                <Menu.Item onClick={() =>
                    triggerNotification({
                        type: "enterTime"
                    })
                }>Trigger Enter Time</Menu.Item>
                <Menu.CheckboxItem onChange={UIService.SetIconBadgeAlert}>Systray alert</Menu.CheckboxItem>
            </Menu.Dropdown>
        </Menu>
        )
    } else {
        return null
    }
}

export const HandyDandyTray = () => {
    return (
        <AppShell withBorder={false} navbar={{width: 100, breakpoint: "0"}}>
            <AppShell.Navbar p="xs"><NavBar /></AppShell.Navbar>
            <AppShell.Main><ErrorBoundary fallback={<FallbackError />}><Outlet /></ErrorBoundary></AppShell.Main>
        </AppShell>
    )
}