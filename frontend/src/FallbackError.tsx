import { Alert, Stack, StackProps } from "@mantine/core";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { ErrorBoundary } from "react-error-boundary";


export type FallbackErrorProps = {
    title?: string
    message?: string
} & StackProps
export const FallbackError = ({ message = "An error occurred.", title="Error", ...props}:FallbackErrorProps) => (
    <Stack h="100vh" align="stretch" p="lg" {...props}>
        <Alert title={title} color="red" icon={<WarningCircleIcon />}>{message}</Alert>
    </Stack>
)

export const DefaultErrorBoundary = ({children, ...props}:FallbackErrorProps) => (
    <ErrorBoundary fallback={<FallbackError {...props}/>}>{children}</ErrorBoundary>
)