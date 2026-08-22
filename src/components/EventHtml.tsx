import { sanitizeEventHtml } from "@/lib/event-html";

export function EventHtml({ html }: { html: string }) {
  return (
    <div
      className="event-prose mt-8 leading-7"
      dangerouslySetInnerHTML={{ __html: sanitizeEventHtml(html) }}
    />
  );
}
