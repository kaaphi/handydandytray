import { ReactNode } from "react"

export type ConditionalWrapperProps = {
    condition?: any
    children: ReactNode
    wrap: (children: ReactNode) => ReactNode
}

export const ConditionalWrapper = ({condition, wrap, children}:ConditionalWrapperProps) => (
    condition ? wrap(children) : children
)

