import { AppShell, Box, Menu, NavLink, NavLinkProps, Stack } from "@mantine/core";
import { BugIcon, ClockIcon, IconProps, ListChecksIcon } from "@phosphor-icons/react";
import { Outlet } from "react-router";
import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from 'react-router';
import { triggerNotification } from "./lib/notifications";
import { randomId } from "@mantine/hooks";

type NavItemProps = {
    icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
} 


const RouterNavItem = ({ icon: Icon, ...props }: NavItemProps & NavLinkProps & RouterNavLinkProps) => {
    return <NavLink {...props} component={RouterNavLink} ta="center" label={<Icon size="25" />} style={{ borderRadius: "5px" }} />
}

const BoxNavItem = ({ icon: Icon, ...props }: NavItemProps & NavLinkProps ) => {
    return <NavLink {...props} component={Box} ta="center" label={<Icon size="25" />} style={{ borderRadius: "5px" }} />
}

const NavBar = () => {
    
    
    return (
        <>
        <AppShell.Section grow>
            <Stack gap="xs">
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

const DevMenu = () => {
    if (import.meta.env.DEV) {
        return (
            
        <Menu>
            <Menu.Target>
                <BoxNavItem icon={BugIcon} description="Dev Menu" />
                {/* <ActionIcon size="sm" variant="subtle"><BugIcon /></ActionIcon> */}
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
            <AppShell.Main><Outlet /></AppShell.Main>
        </AppShell>
    )
}