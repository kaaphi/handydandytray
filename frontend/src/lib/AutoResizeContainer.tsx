import { Window } from "@wailsio/runtime";
import { useEffect, useRef } from "react";

interface AutoResizeContainerProps {
    children?: React.ReactNode;
    width?: number;
    maxHeight?: number;
}

export function AutoResizeContainer({
    children,
    width = 400,
    maxHeight = 600,
}: AutoResizeContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    //handle resizing the window to fit the content up to max height
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let lastHeight = 0;

        const observer = new ResizeObserver(async () => {
            //logic in here is more complicated because windows likes to grow from the bottom instead of from the top
            const rect = el.getBoundingClientRect();
            const exactHeight = Math.ceil(rect.height);

            const newHeight = Math.min(exactHeight, maxHeight);
            if (newHeight === lastHeight || newHeight === 0) return;

            // Get current window coordinates and dimensions
            const { x: currentX, y: currentY } = await Window.Position();
            const { height: currentHeight } = await Window.Size();

            // Calculate Y adjustment so the bottom edge stays stationary
            const heightDelta = newHeight - currentHeight;
            const newY = currentY - heightDelta;

            // Apply new size and reposition
            console.log("Setting size to", width, newHeight)
            await Window.SetSize(width, newHeight);
            await Window.SetPosition(currentX, newY);

            lastHeight = newHeight;
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [width, maxHeight]);

    return (
        <div
            ref={containerRef}
            style={{
                width: `${width}px`,
                maxHeight: `${maxHeight}px`,
                height: 'fit-content', // Sizes container to content up to maxHeight
                overflowY: 'auto',
                overflowX: 'hidden',
                // scrollbarGutter: 'stable', // <-- Reserves space for the scrollbar to prevent layout shifts
                boxSizing: 'border-box',
            }}
        >
            {children}
        </div>
    );
}