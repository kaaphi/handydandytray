import { ActionIcon, ActionIconProps, ElementProps, Tooltip } from "@mantine/core";

export type TooltipActionIconProps = ActionIconProps &
  ElementProps<'button', keyof ActionIconProps> & {
    tooltip?: string;
  };
export const TooltipActionIcon = ({tooltip, ...props}: TooltipActionIconProps) => (
    <Tooltip label={tooltip} openDelay={500}>
        <ActionIcon {...props}/>
    </Tooltip>
)