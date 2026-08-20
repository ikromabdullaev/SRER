"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { useCallback, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * The Weekly editor.
 *
 * Produces HTML that the server sanitises again on save. That double handling
 * is deliberate: the editor's output is a convenience, the server's clean is
 * the guarantee. Never treat what comes out of here as safe.
 *
 * No mathematical notation — LaTeX is out of scope. Footnotes are deferred;
 * the sanitiser already permits their markup, so adding them later is a
 * custom node rather than a schema change.
 */

const IMAGE_BUCKET = "post-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function ToolbarButton({
  editor,
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  editor: Editor;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active ?? false}
      disabled={disabled || !editor.isEditable}
      className={active ? "is-active" : undefined}
      // onMouseDown, not onClick: clicking a toolbar button would otherwise
      // blur the editor and drop the selection before the command runs.
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // h1 belongs to the page: the post title is the only one.
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false },
      }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: "rich-text__surface", "aria-label": label },
    },
  });

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploadError(null);

      if (!file.type.startsWith("image/")) {
        setUploadError("That file is not an image.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError("Images must be 5 MB or smaller.");
        return;
      }

      setUploading(true);
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // Uploaded with the editor's own session, so the storage policy decides
      // whether they may write. Random name, original extension: two editors
      // uploading "chart.png" must not overwrite each other.
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      setUploading(false);

      if (error) {
        setUploadError(error.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

      // The server sanitiser only keeps images from this bucket, so an image
      // inserted any other way will be stripped on save rather than rendered.
      editor.chain().focus().setImage({ src: publicUrl, alt: "" }).run();
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="rich-text">
      <div className="rich-text__toolbar" role="toolbar" aria-label={label}>
        <ToolbarButton editor={editor} title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton editor={editor} title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>

        <span className="rich-text__sep" />

        {[2, 3, 4].map((level) => (
          <ToolbarButton key={level} editor={editor} title={`Heading ${level}`}
            active={editor.isActive("heading", { level })}
            onClick={() =>
              editor.chain().focus()
                .toggleHeading({ level: level as 2 | 3 | 4 }).run()
            }>H{level}</ToolbarButton>
        ))}

        <span className="rich-text__sep" />

        <ToolbarButton editor={editor} title="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolbarButton>
        <ToolbarButton editor={editor} title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolbarButton>
        <ToolbarButton editor={editor} title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo;</ToolbarButton>

        <span className="rich-text__sep" />

        <ToolbarButton editor={editor} title="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const href = window.prompt("Link URL", previous ?? "https://");
            if (href === null) return;
            if (href === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            // Only http(s), mailto and tel survive the server sanitiser;
            // rejecting others here saves the editor a silent surprise.
            if (!/^(https?:|mailto:|tel:)/i.test(href)) {
              window.alert("Links must start with http://, https://, mailto: or tel:");
              return;
            }
            editor.chain().focus().setLink({ href }).run();
          }}>Link</ToolbarButton>

        <ToolbarButton editor={editor} title="Table"
          onClick={() =>
            editor.chain().focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }>Table</ToolbarButton>

        <ToolbarButton editor={editor} title="Image" disabled={uploading}
          onClick={() => fileInput.current?.click()}>
          {uploading ? "Uploading…" : "Image"}
        </ToolbarButton>

        <span className="rich-text__sep" />

        <ToolbarButton editor={editor} title="Undo"
          onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
        <ToolbarButton editor={editor} title="Redo"
          onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadImage(file);
          event.target.value = "";
        }}
      />

      {uploadError && <p className="admin-error">{uploadError}</p>}

      <EditorContent editor={editor} />
    </div>
  );
}
