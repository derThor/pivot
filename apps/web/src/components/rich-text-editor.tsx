"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code2,
  FileCode,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { ResizableImageNodeView } from "@/components/resizable-image-node-view";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const AlignableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes: { align?: string }) => ({
          "data-align": attributes.align ?? "center",
        }),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || null,
        renderHTML: (attributes: { width?: string | null }) =>
          attributes.width ? { style: `width: ${attributes.width}` } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

const headingSelectItems: Record<string, string> = {
  paragraph: "Normal",
  "1": "Überschrift 1",
  "2": "Überschrift 2",
  "3": "Überschrift 3",
  "4": "Überschrift 4",
  "5": "Überschrift 5",
  "6": "Überschrift 6",
};

const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

const editorContentClassName = cn(
  "flex flex-1 flex-col px-2.5 py-2 text-base md:text-sm",
  "[&_.tiptap]:min-h-24 [&_.tiptap]:flex-1 [&_.tiptap]:outline-none",
  "[&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold",
  "[&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold",
  "[&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold",
  "[&_.tiptap_h4]:text-base [&_.tiptap_h4]:font-semibold",
  "[&_.tiptap_h5]:text-sm [&_.tiptap_h5]:font-semibold",
  "[&_.tiptap_h6]:text-xs [&_.tiptap_h6]:font-semibold",
  "[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5",
  "[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5",
  "[&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-input [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:text-muted-foreground",
  "[&_.tiptap_pre]:rounded-md [&_.tiptap_pre]:bg-muted [&_.tiptap_pre]:p-2 [&_.tiptap_pre]:font-mono [&_.tiptap_pre]:text-xs",
  "[&_.tiptap_p]:my-1",
);

export function RichTextEditor({
  value,
  onChange,
  id,
  editable = true,
}: {
  value: string;
  onChange?: (html: string) => void;
  id?: string;
  /** false = schreibgeschützte Vorschau ohne Toolbar (z.B. Versionshistorie). */
  editable?: boolean;
}) {
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [...HEADING_LEVELS] } }),
      AlignableImage,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: [...TEXT_ALIGNMENTS],
      }),
    ],
    content: value,
    editable,
    immediatelyRender: false,
    // Immer registriert (nicht an `editable` zur Erstellungszeit
    // gekoppelt): externe Syncs (siehe Effect unten) nutzen bewusst
    // `emitUpdate: false` und lösen dieses Callback ohnehin nie aus, ein
    // schreibgeschützter Editor lässt gar keine Nutzereingabe zu. Wäre
    // `onUpdate` hier stattdessen `editable ? ... : undefined`, würde es
    // beim allerersten Rendern mit `editable=false` dauerhaft
    // `undefined` bleiben, selbst wenn `editable` später auf `true`
    // wechselt (z.B. sobald die Content-Sperre erworben ist) – `useEditor`
    // reagiert nicht automatisch auf spätere Options-Änderungen.
    onUpdate: ({ editor }) => {
      onChange?.(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const isSame = value === (editor.isEmpty ? "" : editor.getHTML());
    if (!isSame) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // `useEditor` übernimmt einen geänderten `editable`-Wert nicht
  // automatisch nach der Erstellung – muss explizit über TipTaps API
  // nachgezogen werden, sonst bleibt ein Editor, der initial (z.B.
  // während die Content-Sperre noch geprüft wird) nicht editierbar war,
  // dauerhaft nicht editierbar, selbst wenn `editable` später `true`
  // wird.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  if (!editable) {
    return (
      <div
        id={id}
        className="rounded-lg border border-input bg-transparent dark:bg-input/30"
      >
        <EditorContent editor={editor} className={editorContentClassName} />
      </div>
    );
  }

  const activeHeadingLevel = HEADING_LEVELS.find((level) =>
    editor.isActive("heading", { level }),
  );
  const headingValue = activeHeadingLevel ? String(activeHeadingLevel) : "paragraph";

  function toggleSourceMode() {
    if (!editor) return;
    if (sourceMode) {
      editor.commands.setContent(sourceValue);
      setSourceMode(false);
    } else {
      setSourceValue(editor.isEmpty ? "" : editor.getHTML());
      setSourceMode(true);
    }
  }

  return (
    <div
      id={id}
      className="flex h-full min-h-0 flex-1 flex-col gap-1 rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-input p-1">
        <Select
          value={headingValue}
          onValueChange={(next) => {
            if (next === "paragraph") {
              editor.chain().focus().setParagraph().run();
            } else {
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(next) as (typeof HEADING_LEVELS)[number] })
                .run();
            }
          }}
          items={headingSelectItems}
          disabled={sourceMode}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(headingSelectItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToolbarButton
          label="Fett"
          active={editor.isActive("bold")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Kursiv"
          active={editor.isActive("italic")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Text linksbündig"
          active={editor.isActive({ textAlign: "left" })}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="Text zentriert"
          active={editor.isActive({ textAlign: "center" })}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="Text rechtsbündig"
          active={editor.isActive({ textAlign: "right" })}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>
        <ToolbarButton
          label="Aufzählungsliste"
          active={editor.isActive("bulletList")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Nummerierte Liste"
          active={editor.isActive("orderedList")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Zitat"
          active={editor.isActive("blockquote")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="Code-Block"
          active={editor.isActive("codeBlock")}
          disabled={sourceMode}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="Bild einfügen"
          disabled={sourceMode}
          onClick={() => setImagePickerOpen(true)}
        >
          <ImagePlus />
        </ToolbarButton>
        <ToolbarButton
          label="Rückgängig"
          disabled={sourceMode}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo />
        </ToolbarButton>
        <ToolbarButton
          label="Wiederholen"
          disabled={sourceMode}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo />
        </ToolbarButton>
        <div className="ml-auto">
          <ToolbarButton
            label={sourceMode ? "HTML-Ansicht verlassen" : "HTML-Quellcode anzeigen"}
            active={sourceMode}
            onClick={toggleSourceMode}
          >
            <FileCode />
          </ToolbarButton>
        </div>
      </div>

      {sourceMode ? (
        <Textarea
          value={sourceValue}
          onChange={(e) => setSourceValue(e.target.value)}
          rows={8}
          className="h-full flex-1 rounded-none border-none focus-visible:ring-0"
        />
      ) : (
        <>
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("image")}
            className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
          >
            <ToolbarButton
              label="Bild links ausrichten (Text umfließt rechts)"
              active={editor.isActive("image", { align: "left" })}
              onClick={() =>
                editor.chain().focus().updateAttributes("image", { align: "left" }).run()
              }
            >
              <AlignLeft />
            </ToolbarButton>
            <ToolbarButton
              label="Bild zentrieren"
              active={editor.isActive("image", { align: "center" })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("image", { align: "center" })
                  .run()
              }
            >
              <AlignCenter />
            </ToolbarButton>
            <ToolbarButton
              label="Bild rechts ausrichten (Text umfließt links)"
              active={editor.isActive("image", { align: "right" })}
              onClick={() =>
                editor.chain().focus().updateAttributes("image", { align: "right" }).run()
              }
            >
              <AlignRight />
            </ToolbarButton>
          </BubbleMenu>
          {/* Bild-Größe/-Ausrichtung/-Umbruch wird vollständig von
              ResizableImageNodeView selbst gesteuert (inline
              Tailwind-Klassen direkt am Element) – bewusst keine
              zusätzlichen `.tiptap img`-Regeln hier, die per höherer
              CSS-Spezifität (Klasse+Tag-Selektor schlägt reine Klasse)
              die NodeView-eigene Breite überschreiben würden. */}
          <EditorContent editor={editor} className={editorContentClassName} />
        </>
      )}

      <ImagePickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={(url, alt) => {
          editor
            .chain()
            .focus()
            .setImage({ src: mediaUrl({ url }), alt })
            .run();
        }}
      />
    </div>
  );
}
