import { sanitizeEventHtml } from "@/lib/event-html";

export function EventHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className ?? "event-prose mt-8 leading-7"}
      dangerouslySetInnerHTML={{ __html: sanitizeEventHtml(html) }}
    />
  );
}
