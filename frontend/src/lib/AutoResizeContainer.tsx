import { Window } from "@wailsio/runtime";
import { useEffect, useRef } from "react";

interface AutoResizeContainerProps {
    children?: React.ReactNode;
    width?: number;
    maxHeight?: number;
    style? : React.CSSProperties;
    growFromTop? : boolean
}

export function AutoResizeContainer({
    children,
    width = 400,
    maxHeight = 600,
    style,
    growFromTop = false,
}: AutoResizeContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    //handle resizing the window to fit the content up to max height
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let lastHeight = 0;

        const observer = new ResizeObserver(async () => {
            const rect = el.getBoundingClientRect();
            const safeContentHeight = Math.ceil(rect.height)+1;
            
            
            const newHeight = Math.min(safeContentHeight, maxHeight);
            if (newHeight === lastHeight || newHeight === 0) return;

            if (growFromTop) {
                //logic in here is more complicated because windows likes to grow from the bottom instead of from the top
                // Get current window coordinates and dimensions
                const { x: currentX, y: currentY } = await Window.Position();
                const { height: currentHeight } = await Window.Size();

                // Calculate Y adjustment so the bottom edge stays stationary
                const heightDelta = newHeight - currentHeight;
                const newY = currentY - heightDelta;
                await Window.SetPosition(currentX, newY);
            }

            // Apply new size
            await Window.SetSize(width, newHeight);

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
                boxSizing: 'border-box',
                ...style
            }}
        >
            {children}
        </div>
    );
}