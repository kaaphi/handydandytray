import { NotificationEventData } from "../Notifications"
import { Events } from '@wailsio/runtime';

export const triggerNotification = (event: NotificationEventData) => {
    Events.Emit("notification:showNotification", event)
}