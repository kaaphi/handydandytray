import { Typography } from "@mantine/core"
import { Browser } from "@wailsio/runtime"
import { marked } from "marked"

export type MarkdownViewerProps = {
    markdown: string
}

export const MarkdownViewer = ({ markdown }: MarkdownViewerProps) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest('a');

        if (!anchor) return;

        // CRITICAL: Use getAttribute to get the raw markdown href, 
        // NOT anchor.href which resolves to the local dev server.
        const rawHref = anchor.getAttribute('href');

        // Check if the original markdown link was an external web link
        if (rawHref && /^https?:\/\//i.test(rawHref)) {
            e.preventDefault();
            // Delegate to the OS shell execute to open the default system browser
            Browser.OpenURL(rawHref);
        }
    };

    return (
        <Typography>
            <div onClickCapture={handleClick} dangerouslySetInnerHTML={{ __html: marked.parse(markdown) }} />
        </Typography>
    )
}