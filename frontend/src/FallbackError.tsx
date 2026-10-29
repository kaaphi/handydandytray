import { Alert, Stack, StackProps } from "@mantine/core";
import { WarningCircleIcon } from "@phosphor-icons/react";


export type FallbackErrorProps = {
    title?: string
    message?: string
} & StackProps
export const FallbackError = ({ message = "An error occurred.", title="Error", ...props}:FallbackErrorProps) => (
    <Stack h="100vh" align="stretch" p="lg" {...props}>
        <Alert title={title} color="red" icon={<WarningCircleIcon />}>{message}</Alert>
    </Stack>
)