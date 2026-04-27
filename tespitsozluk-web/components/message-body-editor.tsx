"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor, JSONContent } from "@tiptap/core"
import HardBreak from "@tiptap/extension-hard-break"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import { MessageTextareaToolbar } from "@/components/message-textarea-toolbar"
import { MAX_PRIVATE_MESSAGE_LEN } from "@/lib/messaging"
import { messageEditorToMarkdown, messageMarkdownToDocJson, MESSAGE_INLINE_IMAGE_CLASS } from "@/lib/message-tiptap"
import { cn } from "@/lib/utils"
import { ENTRY_BODY_RENDERER_CLASSNAME, ENTRY_BODY_TIPTAP_ROOT_CLASS } from "@/lib/entry-body-renderer-classes"

const MessageBodyHardBreak = HardBreak.extend({
  priority: 2500,
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.setHardBreak(),
      "Shift-Enter": () => this.editor.commands.setHardBreak(),
      Enter: () => this.editor.commands.setHardBreak(),
    }
  },
})

type MessageBodyEditorProps = {
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  minHeightClass?: string
  /** Dialog açıldığında reset ile senkron */
  inputKey?: string
  /** Sohbet ekranı: ince, çerçevesiz, kompakt giriş */
  variant?: "default" | "chat"
}

function insertStringIntoMessageEditor(editor: Editor, insert: string) {
  if (!insert) return
  if (!insert.includes("![")) {
    editor.chain().focus().insertContent(insert).run()
    return
  }
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g
  const out: JSONContent[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(insert)) !== null) {
    if (m.index > last) {
      const t = insert.slice(last, m.index)
      if (t) {
        out.push({ type: "text", text: t })
      }
    }
    const src = (m[2] ?? "").trim()
    if (src) {
      const alt = (m[1] ?? "Görsel").replace(/[[\]]/g, "").trim() || "Görsel"
      out.push({ type: "image", attrs: { src, alt } })
    }
    last = m.index + m[0].length
  }
  if (last < insert.length) {
    const t = insert.slice(last)
    if (t) {
      out.push({ type: "text", text: t })
    }
  }
  if (out.length > 0) {
    editor.chain().focus().insertContent(out).run()
  } else {
    editor.chain().focus().insertContent(insert).run()
  }
}

export function MessageBodyEditor({
  value,
  onChange,
  disabled,
  placeholder = "Yaz…",
  className,
  minHeightClass = "min-h-[120px]",
  inputKey,
  variant = "default",
}: MessageBodyEditorProps) {
  const charRef = useRef(0)
  const isChat = variant === "chat"
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        heading: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
        underline: false,
        hardBreak: false,
        trailingNode: false,
        dropcursor: false,
        gapcursor: false,
      }),
      MessageBodyHardBreak,
      Placeholder.configure({ placeholder }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: { class: MESSAGE_INLINE_IMAGE_CLASS },
      }),
    ],
    content: messageMarkdownToDocJson(value),
    editorProps: {
      attributes: {
        class: cn(
          "tiptap max-w-none min-w-0 w-full min-h-[inherit] break-words whitespace-pre-wrap text-foreground",
          "focus:outline-none focus-visible:outline-none focus-visible:ring-0 ring-0 shadow-none",
          isChat
            ? "px-2.5 py-1.5 text-sm leading-snug [&_p]:!m-0 [&_p]:!p-0 [&_p]:!text-foreground [&_p]:!text-sm [&_p]:!leading-snug"
            : "px-3 py-2.5 sm:px-3 sm:py-3 text-sm",
          !isChat && ENTRY_BODY_TIPTAP_ROOT_CLASS,
          !isChat && ENTRY_BODY_RENDERER_CLASSNAME,
          isChat
            ? "[&_.ProseMirror-selectednode]:ring-1 [&_.ProseMirror-selectednode]:ring-primary/30 [&_.ProseMirror-selectednode]:ring-offset-0"
            : "[&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.ProseMirror-selectednode]:ring-offset-1 [&_.ProseMirror-selectednode]:ring-offset-background [&_.ProseMirror-selectednode]:rounded-sm",
          isChat ? "min-h-[2.25rem]" : minHeightClass,
        ),
      },
      handleKeyDown: (_view, event) => {
        const isChar = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        if (isChar && charRef.current >= MAX_PRIVATE_MESSAGE_LEN) {
          event.preventDefault()
          return true
        }
        return false
      },
    },
    editable: !disabled,
    onCreate: ({ editor: e }) => {
      charRef.current = messageEditorToMarkdown(e).length
    },
    onUpdate: ({ editor: e }) => {
      let next = messageEditorToMarkdown(e)
      if (next.length > MAX_PRIVATE_MESSAGE_LEN) {
        e.commands.undo()
        next = messageEditorToMarkdown(e)
      }
      charRef.current = next.length
      onChange(next)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useLayoutEffect(() => {
    if (!editor) return
    const fromEditor = messageEditorToMarkdown(editor)
    const v = value ?? ""
    if (fromEditor === v) return
    editor.commands.setContent(messageMarkdownToDocJson(v) as never, { emitUpdate: false })
    charRef.current = messageEditorToMarkdown(editor).length
  }, [value, editor, inputKey])

  const handleInsert = useCallback(
    (text: string) => {
      if (!editor || disabled) return
      if (messageEditorToMarkdown(editor).length >= MAX_PRIVATE_MESSAGE_LEN) return
      insertStringIntoMessageEditor(editor, text)
    },
    [editor, disabled],
  )

  return (
    <div
      className={cn(
        isChat
          ? "overflow-hidden rounded-2xl border-0 bg-slate-100/50 shadow-none ring-0 ring-offset-0 focus-within:ring-0 focus-within:ring-offset-0 dark:bg-slate-800/30"
          : "overflow-hidden rounded-md border border-border bg-background",
        disabled && "pointer-events-none opacity-70",
        className,
      )}
    >
      <MessageTextareaToolbar
        onInsert={handleInsert}
        disabled={disabled}
        attachedAboveTextarea
        variant={isChat ? "compact" : "default"}
      />
      <EditorContent
        editor={editor}
        className={cn(
          "overflow-y-auto [scrollbar-gutter:stable]",
          isChat
            ? "max-h-[6.5rem] min-h-0 bg-transparent"
            : "max-h-[40vh] min-h-0 bg-background",
        )}
      />
    </div>
  )
}
