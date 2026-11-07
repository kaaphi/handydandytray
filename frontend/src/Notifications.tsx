import React, { ReactNode, useEffect, useState } from "react";
import { AutoResizeContainer } from "./lib/AutoResizeContainer";
import { Button, CloseButton, Group, Paper, Space, Stack, Text } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import PawIcon from './assets/paw-icon.svg?react';
import { useListState, useMap } from "@mantine/hooks";
import { UIService } from "../bindings/handydandytray/internal/ui";
import { useTodo } from "./hooks/useTodos";
import { marked } from "marked";
import { BellZIcon, ClockUserIcon } from "@phosphor-icons/react";
import { usePulseBackground } from "./hooks/usePulseBackground";

const NOTIFICATION_TIMEOUT_MS = 10000

type InternalNotificationContainerProps = {
    remove: () => void
}

type NotificationContainerProps = {
    children: ReactNode
    title: string
    onClick?: () => void
    removeOnClick?: boolean
    withPulse?: boolean
} & InternalNotificationContainerProps

const NotificationContainer = ({ children, title, onClick = () => { }, remove, removeOnClick = false, withPulse = false }: NotificationContainerProps) => {
    const pulseRef = usePulseBackground({initialDelay: 5000, pulseDuration: 1000, pulseColor: "handyDandyPink.2", iterations: 3})
    
    return (
        <Paper 
            ref={withPulse ? pulseRef : null}
            h="fit-content"
            shadow="0"
            withBorder
            p="sm"
            style={{
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden',
                borderWidth: "3px"
            }}
            onClick={() => {
                if (removeOnClick) {
                    remove()
                }
                onClick()
            }}
        >
            <Group align="center" mb="xs" style={{ flexShrink: 0 }}>
                <PawIcon width={16} height={16} />
                <Text fw={600} size="sm" c="dimmed">
                    {title}
                </Text>
                <Space style={{ flex: 1 }} />
                <CloseButton onClick={(e) => {
                    e.stopPropagation()
                    remove()
                }
                } size="sm" aria-label="Close notification" />
            </Group>
            {children}
        </Paper>
    )
}


export type NotificationProps = {
    containerProps: InternalNotificationContainerProps
    props: Record<string, string>
}

const TextNotification = ({ props, containerProps }: NotificationProps) => {
    const [text, setText] = useState("")

    useEffect(() => {
        const timeout = setTimeout(() => {
            setText(props.text)
        }, 100)

        return () => clearTimeout(timeout)
    }, [setText, props])

    return <NotificationContainer {...containerProps} title={props.title || "Handy Dandy Notification"}>
        <Text>{text}</Text>
    </NotificationContainer>
}

const getPlainTextFromMarkdown = (markdown?: string): string => {
    if (!markdown) {
        return "&nbsp;"
    }

    const rawHtml = marked.parse(markdown, { async: false }) as string;

    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    return doc.body.textContent || '';
}

const TodoNotification = ({ props, containerProps }: NotificationProps) => {
    const todo = useTodo(props.todoId)

    return <NotificationContainer title="Todo Reminder" {...containerProps} removeOnClick onClick={() => {
        UIService.OpenMainWindow()
        if (todo.data?.id) {
            Events.Emit("todo:reminderClicked", todo.data.id);
        }
    }}>
        <Text lineClamp={3}>{getPlainTextFromMarkdown(todo.data?.description)}</Text>

    </NotificationContainer>
}

const EnterTimeNotification = ({ containerProps }: NotificationProps) => {
    return <NotificationContainer withPulse title="Enter Time" {...containerProps}>
        <Group justify="center" grow>
            <Button variant="light" leftSection={<ClockUserIcon />} onClick={() => {
                UIService.OpenEnterTimeWindow()
                containerProps.remove()
            }}>Enter Time</Button>
            <Button variant="outline" leftSection={<BellZIcon />} onClick={() => {
                UIService.SnoozeEnterTime()
                containerProps.remove()
            }}>Snooze</Button>
        </Group>
    </NotificationContainer>
}

const notificationSingletons = ["entertime"]
type NotificationSingletonType = typeof notificationSingletons[number]

type NotificationSpecification = {
    component: React.ElementType,
    persistent: boolean
    singletonType?: NotificationSingletonType
}

const notificationTypes = {
    text: {
        component: TextNotification,
        persistent: true,
    },
    todo: {
        component: TodoNotification,
        persistent: false,
    },
    enterTime: {
        component: EnterTimeNotification,
        persistent: true,
        singletonType: "entertime"
    }
} satisfies Record<string, NotificationSpecification>

export type NotificationEventData = {
    type: keyof typeof notificationTypes,
    props?: Record<string, string>,
}

export const Notifications = () => {
    const [notifications, notificationsHandlers] = useListState<NotificationEventData>([])
    const singletonNotifications = useMap<NotificationSingletonType, NotificationEventData>()

    useEffect(() => {
        let canceled = false

        const unsubscribe = Events.On("notification:showNotification", (event) => {
            const notificationEvent = event.data as NotificationEventData;
            console.log("Got notification event!", notificationEvent)

            const type: NotificationSpecification = notificationTypes[notificationEvent.type]

            if (type.singletonType) {
                singletonNotifications.set(type.singletonType!, notificationEvent)
                if (!type.persistent) {
                    setTimeout(() => {
                        if (canceled) return;
                        singletonNotifications.delete(type.singletonType!)
                    }, NOTIFICATION_TIMEOUT_MS)
                }
            } else {
                notificationsHandlers.append(notificationEvent)
                if (!type.persistent) {
                    setTimeout(() => {
                        if (canceled) return;
                        notificationsHandlers.filter((item) => item !== notificationEvent)
                    }, NOTIFICATION_TIMEOUT_MS)
                }
            }

            UIService.ShowNotificationsWindow()
        });

        return () => {
            canceled = true
            unsubscribe() // Clean up listener on unmount
        };
    }, [notificationsHandlers, singletonNotifications])

    if (notifications.length == 0 && singletonNotifications.size == 0) {
        UIService.HideNotifications()
    }

    return (
        <>
            {/* This style only exists in the DOM of the window running this route */}
            <style>{`
        html,
        body,
        #root {
          background: transparent !important;
          background-color: transparent !important;

          overflow: hidden !important;
        }
      `}</style>
            <AutoResizeContainer growFromTop style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarGutter: 'stable', // <-- Reserves space for the scrollbar to prevent layout shifts
                backgroundColor: 'transparent',
            }}>
                <Stack gap="xs" style={{ backgroundColor: 'transparent' }}>
                    {notifications.map((notification, index) => {
                        const NotificationComponent = notificationTypes[notification.type].component

                        return <NotificationComponent key={`notification-${index}`} props={notification.props || {}} containerProps={{
                            remove: () => {
                                notificationsHandlers.remove(index)
                            }
                        }} />
                    })}
                    {notificationSingletons.map((type) => {
                        const notification = singletonNotifications.get(type)
                        if (!notification) {
                            return null
                        }

                        const NotificationComponent = notificationTypes[notification.type].component
                        return <NotificationComponent key={`singleton-notification-${type}`} props={notification.props || {}} containerProps={{
                            remove: () => {
                                singletonNotifications.delete(type)
                            }
                        }} />
                    })}
                </Stack>
            </AutoResizeContainer>
        </>)
}