import sanitizeHtml from "sanitize-html";

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "strong",
    "em",
    "blockquote",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
  },
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener", target: "_blank" }),
  },
};

export function sanitizeEventHtml(html: string) {
  return sanitizeHtml(html, options).trim();
}

export function stripHtml(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
