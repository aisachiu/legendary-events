"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";

function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs ${
        active
          ? "border-[var(--gold)] bg-[var(--gold-soft)]"
          : "border-[var(--line)] bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function asEditorHtml(value?: string) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function DescriptionEditor({
  name,
  defaultValue,
  placeholder = "Tell guests what to expect…",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [html, setHtml] = useState(asEditorHtml(defaultValue));
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: asEditorHtml(defaultValue),
    onUpdate: ({ editor: next }) => setHtml(next.getHTML()),
    editorProps: {
      attributes: {
        class: "event-prose min-h-40 px-3 py-2 focus:outline-none",
      },
    },
  });

  async function addImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/events/description-image", {
          method: "POST",
          body,
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          window.alert(data.error || "Could not upload that image.");
          return;
        }
        editor.chain().focus().setImage({ src: data.url }).run();
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  function addLink() {
    if (!editor) return;
    const href = window.prompt("Link URL", editor.getAttributes("link").href || "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }

  return (
    <div>
      <input type="hidden" name={name} value={html} />
      <div className="mb-2 flex flex-wrap gap-1.5">
        <ToolbarButton
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("heading", { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          Numbers
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive("link")} onClick={addLink}>
          Link
        </ToolbarButton>
        <ToolbarButton onClick={addImage}>{uploading ? "Uploading…" : "Image"}</ToolbarButton>
      </div>
      <div className="field !p-0 overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
