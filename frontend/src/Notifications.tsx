import React, { ReactNode, useEffect, useState } from "react";
import { AutoResizeContainer } from "./lib/AutoResizeContainer";
import { Button, CloseButton, Group, Paper, Space, Stack, Text } from "@mantine/core";
import { Events } from '@wailsio/runtime';
import PawIcon from './assets/paw-icon.svg?react';
import { useListState } from "@mantine/hooks";
import { UIService } from "../bindings/handydandytray/internal/ui";
import { useTodo } from "./hooks/useTodos";
import { marked } from "marked";
import { BellZIcon, ClockUserIcon } from "@phosphor-icons/react";

type InternalNotificationContainerProps = {
    remove: () => void
}

type NotificationContainerProps = {
    children: ReactNode
    title: string
    onClick?: () => void
    removeOnClick?: boolean
} & InternalNotificationContainerProps

const NotificationContainer = ({ children, title, onClick = () => { }, remove, removeOnClick = false }: NotificationContainerProps) => {
    return (
        <Paper h="fit-content"
            // w="100vw"
            // radius={0}
            shadow="0"
            withBorder
            p="sm"
            style={{
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden',
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
        UIService.OpenTodosWindow()
        if (todo.data?.id) {
            Events.Emit("todo:reminderClicked", todo.data.id);
        }
    }}>
        <Text lineClamp={3}>{getPlainTextFromMarkdown(todo.data?.description)}</Text>

    </NotificationContainer>
}

const EnterTimeNotification = ({ containerProps }: NotificationProps) => {
    return <NotificationContainer title="Enter Time" {...containerProps}>
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

type NotificationSpecification = {
    component: React.ElementType,
    allowMultiple: boolean
}

const notificationTypes = {
    text: {
        component: TextNotification,
        allowMultiple: true,
    },
    todo: {
        component: TodoNotification,
        allowMultiple: true
    },
    enterTime: {
        component: EnterTimeNotification,
        allowMultiple: false,
    }
} satisfies Record<string, NotificationSpecification>

export type NotificationEventData = {
    type: keyof typeof notificationTypes,
    props?: Record<string, string>,
}

export const Notifications = () => {
    const [notifications, notificationsHandlers] = useListState<NotificationEventData>([])

    useEffect(() => {
        const unsubscribe = Events.On("notification:showNotification", (event) => {
            const notificationEvent = event.data as NotificationEventData;
            console.log("Got notification event!", notificationEvent)

            const type: NotificationSpecification = notificationTypes[notificationEvent.type]

            if (!type.allowMultiple) {
                notificationsHandlers.filter((item, _) =>
                    item.type != notificationEvent.type
                )
            }

            notificationsHandlers.append(notificationEvent)
            UIService.ShowNotificationsWindow()
        });

        return () => {
            unsubscribe(); // Clean up listener on unmount
        };
    }, [])

    if (notifications.length == 0) {
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

                        return <NotificationComponent props={notification.props || {}} containerProps={{
                            remove: () => {
                                notificationsHandlers.remove(index)
                            }
                        }} />
                    })}
                </Stack>
            </AutoResizeContainer>
        </>)
}