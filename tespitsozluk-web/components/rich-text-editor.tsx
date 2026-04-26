"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import HardBreak from "@tiptap/extension-hard-break"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Smile,
  EyeOff,
  Loader2,
  BarChart3,
} from "lucide-react"
import { PollComposer, type PollComposerValue, createEmptyPoll } from "@/components/poll-composer"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ENTRY_BODY_RENDERER_CLASSNAME,
  ENTRY_BODY_OUTER_WRAPPER_CLASS,
  ENTRY_BODY_TIPTAP_ROOT_CLASS,
} from "@/lib/entry-body-renderer-classes"
import { getApiUrl, apiFetch } from "@/lib/api"
import { SpoilerMark } from "@/components/tiptap-extensions/spoiler-mark"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"
import { escapeHtmlText } from "@/lib/entry-body-link-transforms"
import { EditorLink } from "@/components/tiptap-extensions/editor-link"
import { useEntryPatternExistsValidation } from "@/hooks/use-entry-pattern-exists-validation"
import {
  editorImageHtmlToMarkdownText,
  entryBodyCharCount,
  storedHtmlToEditorImageHtml,
} from "@/lib/tiptap-entry-image-markdown"

/** Enter = Shift+Enter: yeni paragraf değil, satır sonu (<br>). Mention açıkken Enter seçim için handleKeyDown’da ayrılır. */
const EntryBodyHardBreak = HardBreak.extend({
  priority: 2500,
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.setHardBreak(),
      "Shift-Enter": () => this.editor.commands.setHardBreak(),
      Enter: () => this.editor.commands.setHardBreak(),
    }
  },
})

const CHAR_LIMIT = 100_000
const CHAR_WARN_THRESHOLD = 95_000
const CHAR_DANGER_THRESHOLD = 99_000
const MENTION_DEBOUNCE_MS = 500

type MentionSearchItem = {
  id: string
  username: string
  avatar?: string | null
}

type MentionUiState = {
  rangeFrom: number
  query: string
  rect: { top: number; left: number }
  results: MentionSearchItem[]
  selectedIndex: number
  loading: boolean
}

interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  onCharCountChange?: (count: number) => void
  /** Editör içeriği için min yükseklik (ör. taslak modallarında daha geniş alan) */
  contentMinHeightClass?: string
  /**
   * Sadece gövde sütununda dikey kaydırma (toolbar sabit). Scrollbar genişliği yayınlanan metin sütunundan çalınmasın diye scrollbar-gutter kullanılır.
   */
  bodyScrollMaxHeightClass?: string
  /** Gövde metin alanına ek yatay iç boşluk (yayınlanan entry satır genişliğiyle hizalamak için). */
  innerContentPaddingClassName?: string
  /**
   * Sayfa (navbar altı): `top-[56px]`. Modal/diyalog içi kaydırma: `top-0`.
   */
  toolbarStickyTopClass?: string
  /**
   * Opsiyonel anket entegrasyonu — sağlanırsa formatlama araç çubuğuna "Anket" butonu eklenir
   * ve anket bloğu editör gövdesinin alt kısmında WYSIWYG mantığıyla satır içi olarak görüntülenir.
   *
   * `poll === null`: anket yok (ekleme butonu görünür).
   * `poll !== null`: anket bloğu görünür, editör altında inline render edilir.
   *
   * `onPollChange` verilmezse anket özelliği bu editör örneği için tamamen devre dışıdır.
   */
  poll?: PollComposerValue | null
  onPollChange?: (next: PollComposerValue | null) => void
  pollDisabled?: boolean
}

function ensureHtml(value: string): string {
  if (!value || !value.trim()) return ""
  if (value.trim().startsWith("<")) return value
  return `<p>${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
}

const EDITOR_INLINE_IMAGE_CLASS =
  "!inline w-[1.2em] h-[1.2em] max-h-[1em] object-cover rounded-sm align-middle mx-1 border border-muted-foreground/10 hover:opacity-80 transition-opacity !m-0"

function toTipTapEditorHtml(raw: string): string {
  const h = ensureHtml(raw)
  return storedHtmlToEditorImageHtml(editorImageHtmlToMarkdownText(h), EDITOR_INLINE_IMAGE_CLASS)
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  onCharCountChange,
  contentMinHeightClass = "min-h-[150px]",
  bodyScrollMaxHeightClass,
  innerContentPaddingClassName,
  toolbarStickyTopClass = "top-[56px]",
  poll,
  onPollChange,
  pollDisabled,
}: RichTextEditorProps) {
  const pollEnabled = typeof onPollChange === "function"
  const handleAddPoll = useCallback(() => {
    if (!onPollChange) return
    if (poll == null) {
      onPollChange(createEmptyPoll())
    }
  }, [onPollChange, poll])
  const handlePollRemove = useCallback(() => {
    onPollChange?.(null)
  }, [onPollChange])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [mediaModal, setMediaModal] = useState<{ type: "image" | "video" } | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadBatchTotal, setImageUploadBatchTotal] = useState(0)
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const [linkData, setLinkData] = useState({ text: "", url: "" })
  const [charCount, setCharCount] = useState(0)
  const charCountRef = useRef(0)
  const [mention, setMention] = useState<MentionUiState | null>(null)
  const mentionRef = useRef<MentionUiState | null>(null)
  const editorRef = useRef<Editor | null>(null)
  /** Escape ile kapatıldı; imleç hareket edene kadar aynı konumda popover açılmasın */
  const mentionEscapeSuppressAtRef = useRef<number | null>(null)

  useEffect(() => {
    mentionRef.current = mention
  }, [mention])

  const updateCharCount = useCallback((count: number) => {
    charCountRef.current = count
    setCharCount(count)
    onCharCountChange?.(count)
  }, [onCharCountChange])

  const insertMention = useCallback((item: MentionSearchItem) => {
    const ed = editorRef.current
    const m = mentionRef.current
    if (!ed || !m || !item.id) return
    const pos = ed.state.selection.from
    mentionEscapeSuppressAtRef.current = null
    const safe = escapeHtmlText(item.username)
    ed.chain()
      .focus()
      .deleteRange({ from: m.rangeFrom, to: pos })
      .insertContent(
        `<a href="/user/${item.id}" target="_blank" rel="noopener noreferrer" class="text-emerald-600 dark:text-emerald-400 hover:underline">@${safe}</a> `
      )
      .run()
    setMention(null)
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        link: false,
        hardBreak: false,
      }),
      EntryBodyHardBreak,
      EditorLink.configure({
        autolink: true,
        openOnClick: false,
        HTMLAttributes: {
          class: "text-emerald-600 dark:text-emerald-400 hover:underline",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        isAllowedUri: (url, ctx) => {
          const u = (url ?? "").trim()
          if (!u) return false
          if (u.startsWith("/") && !u.startsWith("//")) return true
          return ctx.defaultValidate(u)
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "düşüncelerinizi yazın...",
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: EDITOR_INLINE_IMAGE_CLASS,
        },
      }),
      SpoilerMark,
    ],
    content: toTipTapEditorHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "tiptap focus:outline-none max-w-none min-w-0 w-full max-w-full min-h-[inherit] break-words whitespace-pre-wrap p-4 text-foreground",
          ENTRY_BODY_TIPTAP_ROOT_CLASS,
          "prose-a:text-emerald-500 prose-a:font-medium prose-a:no-underline prose-a:underline-offset-2 prose-a:hover:underline",
          ENTRY_BODY_RENDERER_CLASSNAME,
          "[&_p]:!text-foreground [&_li]:!text-foreground [&_blockquote]:!text-foreground",
          "[&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.ProseMirror-selectednode]:ring-offset-2 [&_.ProseMirror-selectednode]:ring-offset-background [&_.ProseMirror-selectednode]:rounded-sm",
          contentMinHeightClass
        ),
      },
      handleClick: (view, _pos, event) => {
        if (event.button !== 0) return false
        const el = (event.target as HTMLElement | null)?.closest?.("a")
        if (!el || !view.dom.contains(el)) return false
        const href = el.getAttribute("href")
        if (!href?.trim() || href.trim().toLowerCase().startsWith("javascript:")) return false
        event.preventDefault()
        event.stopPropagation()
        window.open(href, "_blank", "noopener,noreferrer")
        requestAnimationFrame(() => {
          view.focus()
        })
        return true
      },
      handleKeyDown: (_view, event) => {
        const m = mentionRef.current
        if (m && m.results.length > 0 && event.key === "Enter" && !event.shiftKey) {
          const pick = m.results[m.selectedIndex]
          if (pick) {
            event.preventDefault()
            insertMention(pick)
            return true
          }
        }
        if (m && m.results.length > 0) {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setMention((prev) =>
              prev
                ? {
                    ...prev,
                    selectedIndex: Math.min(prev.results.length - 1, prev.selectedIndex + 1),
                  }
                : null
            )
            return true
          }
          if (event.key === "ArrowUp") {
            event.preventDefault()
            setMention((prev) =>
              prev ? { ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) } : null
            )
            return true
          }
        }
        if (m && event.key === "Escape") {
          event.preventDefault()
          const ed = editorRef.current
          if (ed) mentionEscapeSuppressAtRef.current = ed.state.selection.from
          setMention(null)
          return true
        }
        // Karakter ekleme tuşlarını 10.000 limitinde engelle
        const isCharKey = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        if (isCharKey && charCountRef.current >= CHAR_LIMIT) return true
        return false
      },
    },
    onCreate: ({ editor }) => {
      updateCharCount(entryBodyCharCount(editor))
    },
    onUpdate: ({ editor }) => {
      updateCharCount(entryBodyCharCount(editor))
      onChange(editorImageHtmlToMarkdownText(editor.getHTML()))
    },
  })

  useEffect(() => {
    if (!editor) return
    editorRef.current = editor
    return () => {
      editorRef.current = null
    }
  }, [editor])

  useEntryPatternExistsValidation(editor)

  useEffect(() => {
    if (!editor) return
    const syncMention = () => {
      const { from } = editor.state.selection
      if (mentionEscapeSuppressAtRef.current !== null) {
        if (from !== mentionEscapeSuppressAtRef.current) {
          mentionEscapeSuppressAtRef.current = null
        } else {
          const textBefore = editor.state.doc.textBetween(0, from, "\n", "\n")
          if (/@([^\s@]*)$/.test(textBefore)) {
            setMention(null)
            return
          }
          mentionEscapeSuppressAtRef.current = null
        }
      }
      const textBefore = editor.state.doc.textBetween(0, from, "\n", "\n")
      const match = textBefore.match(/@([^\s@]*)$/)
      if (!match) {
        setMention(null)
        return
      }
      const query = match[1]
      const rangeFrom = from - match[0].length
      const coords = editor.view.coordsAtPos(from)
      setMention((prev) => ({
        rangeFrom,
        query,
        rect: { top: coords.bottom + 4, left: coords.left },
        results: prev && prev.query === query ? prev.results : [],
        selectedIndex: prev && prev.query === query ? prev.selectedIndex : 0,
        loading: prev && prev.query === query ? prev.loading : false,
      }))
    }
    editor.on("update", syncMention)
    editor.on("selectionUpdate", syncMention)
    syncMention()
    return () => {
      editor.off("update", syncMention)
      editor.off("selectionUpdate", syncMention)
    }
  }, [editor])

  useEffect(() => {
    if (mention === null) return
    const q = mention.query
    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      setMention((prev) => (prev && prev.query === q ? { ...prev, loading: true } : prev))
      try {
        const res = await apiFetch(getApiUrl(`api/Users/search?q=${encodeURIComponent(q)}`), {
          signal: ac.signal,
        })
        if (!res.ok) throw new Error("mention_search")
        const data: unknown = await res.json()
        const raw = Array.isArray(data) ? data : []
        const results: MentionSearchItem[] = raw
          .map((row) => {
            const r = row as Record<string, unknown>
            return {
              id: String(r.id ?? ""),
              username: typeof r.username === "string" ? r.username : "",
              avatar: typeof r.avatar === "string" || r.avatar === null ? (r.avatar as string | null) : null,
            }
          })
          .filter((x) => x.id && x.username)
        setMention((prev) => {
          if (!prev || prev.query !== q) return prev
          const sel = Math.min(prev.selectedIndex, Math.max(0, results.length - 1))
          return { ...prev, results, loading: false, selectedIndex: sel }
        })
      } catch {
        if (ac.signal.aborted) return
        setMention((prev) => (prev && prev.query === q ? { ...prev, results: [], loading: false } : prev))
      }
    }, MENTION_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [mention?.query])

  useEffect(() => {
    if (!editor) return
    const persisted = editorImageHtmlToMarkdownText(ensureHtml(value))
    const fromEditor = editorImageHtmlToMarkdownText(editor.getHTML())
    if (persisted === fromEditor) return
    editor.commands.setContent(toTipTapEditorHtml(value), { emitUpdate: false })
    updateCharCount(entryBodyCharCount(editor))
  }, [value, editor, updateCharCount])

  const openLinkModal = useCallback(() => {
    setLinkData({ text: "", url: "" })
    setLinkModalOpen(true)
  }, [])

  const submitLink = useCallback(() => {
    if (!editor) return
    const { text, url } = linkData
    if (!url?.trim()) return
    const safeUrl = url.replace(/"/g, "&quot;")
    const displayText = (text?.trim() || url).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    editor.chain().focus().insertContent(`<a href="${safeUrl}" title="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${displayText}</a> `).run()
    setLinkModalOpen(false)
    setLinkData({ text: "", url: "" })
  }, [editor, linkData])

  const openImageGuide = useCallback(() => {
    setImageUploading(false)
    setImageUploadBatchTotal(0)
    setMediaModal({ type: "image" })
  }, [])
  const openVideoGuide = useCallback(() => {
    setImageUploading(false)
    setImageUploadBatchTotal(0)
    setMediaModal({ type: "video" })
  }, [])

  const closeMediaModal = useCallback(() => {
    setMediaModal(null)
    setImageUploading(false)
    setImageUploadBatchTotal(0)
  }, [])

  const handleImageFilesSelected = useCallback(
    async (files: File[]) => {
      if (!editor) return
      const imageFiles = files.filter((f) => f.type.startsWith("image/"))
      if (imageFiles.length === 0) {
        toast.error("Lütfen en az bir görsel dosyası seçin.")
        return
      }
      setImageUploading(true)
      setImageUploadBatchTotal(imageFiles.length)
      try {
        const urls = (
          await Promise.all(
            imageFiles.map(async (file) => {
              try {
                const fd = new FormData()
                fd.append("image", file)
                const res = await fetch("/api/upload-imgbb", {
                  method: "POST",
                  body: fd,
                })
                const data: unknown = await res.json().catch(() => ({}))
                if (!res.ok) {
                  return null
                }
                const url =
                  typeof data === "object" && data !== null && "url" in data
                    ? (data as { url?: unknown }).url
                    : undefined
                if (typeof url !== "string" || !url.trim()) return null
                return url.trim()
              } catch {
                return null
              }
            }),
          )
        ).filter((u): u is string => u != null)

        if (urls.length === 0) {
          toast.error("Görseller yüklenemedi.")
          return
        }
        if (urls.length < imageFiles.length) {
          toast.warning("Bazı görseller yüklenemedi.")
        }
        const markdown = urls.map((u) => `![Görsel](${u})`).join(" ")
        const html = storedHtmlToEditorImageHtml(markdown, EDITOR_INLINE_IMAGE_CLASS)
        editor.chain().focus().insertContent(html).run()
        closeMediaModal()
      } catch {
        toast.error("Görsel yüklenemedi.")
      } finally {
        setImageUploading(false)
        setImageUploadBatchTotal(0)
      }
    },
    [editor, closeMediaModal],
  )

  const onImageFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawFiles = e.target.files
      if (!rawFiles) return
      const filesArray = Array.from(rawFiles)
      e.target.value = ""
      void handleImageFilesSelected(filesArray)
    },
    [handleImageFilesSelected],
  )

  const onImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (imageUploading) return
      const rawFiles = e.dataTransfer.files
      if (!rawFiles) return
      const filesArray = Array.from(rawFiles)
      void handleImageFilesSelected(filesArray)
    },
    [handleImageFilesSelected, imageUploading],
  )

  const insertEmoji = useCallback(
    (emoji: { native?: string }) => {
      if (!editor || !emoji.native) return
      editor.chain().focus().insertContent(emoji.native).run()
      setEmojiOpen(false)
    },
    [editor]
  )

  const toggleSpoiler = useCallback(() => {
    if (!editor) return
    editor.chain().focus().toggleSpoiler().run()
  }, [editor])

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
    disabled,
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
    disabled?: boolean
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 shrink-0",
        isActive && "bg-muted text-foreground"
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )

  if (!editor) return null

  return (
    <div className="min-h-[150px] w-full min-w-0 max-w-full rounded-lg border border-border bg-card box-border">
      <div
        className={cn(
          "sticky z-30 flex w-full flex-wrap items-center gap-0.5 border-b border-border bg-gray-100 dark:bg-[#2b2d2e] px-1 py-1.5",
          toolbarStickyTopClass
        )}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Kalın (Bold)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="İtalik (Italic)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Üstü Çizili (Strikethrough)"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolbarButton onClick={openLinkModal} title="Link Ekle">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openImageGuide} title="Fotoğraf Ekle">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openVideoGuide} title="Video Rehberi">
          <YoutubeIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-0.5" />
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[100] w-auto p-0 border-0"
            align="start"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <Picker
              data={data}
              onEmojiSelect={insertEmoji}
              theme="light"
              previewPosition="none"
            />
          </PopoverContent>
        </Popover>
        <ToolbarButton
          onClick={toggleSpoiler}
          isActive={editor.isActive("spoiler")}
          title="Spoiler"
        >
          <EyeOff className="h-4 w-4" />
        </ToolbarButton>
        {pollEnabled && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <ToolbarButton
              onClick={handleAddPoll}
              isActive={poll != null}
              disabled={pollDisabled || poll != null}
              title={poll != null ? "Anket eklendi" : "Anket Ekle"}
            >
              <BarChart3 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
      </div>
      <div className={cn(ENTRY_BODY_OUTER_WRAPPER_CLASS, "mb-0 w-full")}>
        <div
          className={cn(
            "relative w-full min-w-0 max-w-full whitespace-pre-wrap break-words box-border",
            bodyScrollMaxHeightClass &&
              cn(
                "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
                bodyScrollMaxHeightClass
              )
          )}
        >
          <div
            className={cn(
              "entry-text w-full min-w-0 max-w-full min-h-[inherit]",
              innerContentPaddingClassName
            )}
          >
            <EditorContent editor={editor} />
            {mention && (
              <div
                role="listbox"
                aria-label="Kullanıcı ara"
                className="fixed z-[100] min-w-[220px] max-w-[min(100vw-1rem,280px)] rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                style={{ top: mention.rect.top, left: mention.rect.left }}
              >
                {mention.loading && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Aranıyor…</p>
                )}
                {!mention.loading && mention.results.length === 0 && mention.query.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Kullanıcı adı yazmaya devam edin</p>
                )}
                {!mention.loading && mention.results.length === 0 && mention.query.length > 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Sonuç yok</p>
                )}
                {mention.results.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={i === mention.selectedIndex}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none",
                      i === mention.selectedIndex ? "bg-muted" : "hover:bg-muted/80"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() =>
                      setMention((prev) => (prev ? { ...prev, selectedIndex: i } : null))
                    }
                    onClick={() => insertMention(u)}
                  >
                    {u.avatar?.startsWith("http") ? (
                      <img
                        src={u.avatar}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover border border-border/60"
                        referrerPolicy="no-referrer"
                      />
                    ) : u.avatar ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-sm border border-border/60">
                        {u.avatar}
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground border border-border/60">
                        {(u.username.charAt(0) || "?").toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 truncate font-medium">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Karakter Sayacı — 95.000+ karakterde belirgin hale gelir */}
            <div
              className={cn(
                "absolute bottom-2 right-3 text-xs font-mono tabular-nums select-none pointer-events-none transition-all duration-500",
                charCount > CHAR_WARN_THRESHOLD ? "opacity-100" : "opacity-0",
                charCount >= CHAR_LIMIT
                  ? "text-red-500 font-bold animate-pulse"
                  : charCount >= CHAR_DANGER_THRESHOLD
                  ? "text-red-400 font-semibold"
                  : "text-orange-500"
              )}
            >
              {charCount.toLocaleString("tr-TR")}/100.000 karakter
            </div>
          </div>
          {/* WYSIWYG: Anket bloğu editör gövdesinin içinde, metnin hemen altında —
              paylaşıldığında görüneceği görselliğe yakın bir önizleme verir. */}
          {pollEnabled && poll != null && onPollChange && (
            <div className="border-t border-border/70 bg-background/30">
              <PollComposer
                value={poll}
                onChange={onPollChange}
                onRemove={handlePollRemove}
                disabled={pollDisabled}
                seamless
              />
            </div>
          )}
        </div>
      </div>

      {/* Link Ekleme Modalı */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="link-text">Link İsmi</Label>
              <Input
                id="link-text"
                placeholder="Görünecek metin (opsiyonel)"
                value={linkData.text}
                onChange={(e) => setLinkData((d) => ({ ...d, text: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL (https://...)</Label>
              <Input
                id="link-url"
                placeholder="https://..."
                value={linkData.url}
                onChange={(e) => setLinkData((d) => ({ ...d, url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={submitLink} disabled={!linkData.url?.trim()}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fotoğraf/Video Rehberi Modalı */}
      <Dialog
        open={!!mediaModal}
        onOpenChange={(open) => {
          if (!open) {
            if (mediaModal?.type === "image" && imageUploading) return
            closeMediaModal()
          }
        }}
      >
        <DialogContent
          className={cn(
            mediaModal?.type === "image" ? "sm:max-w-sm gap-3 p-4" : "sm:max-w-md",
          )}
          showCloseButton={!(mediaModal?.type === "image" && imageUploading)}
          onPointerDownOutside={(e) => {
            if (mediaModal?.type === "image" && imageUploading) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (mediaModal?.type === "image" && imageUploading) e.preventDefault()
          }}
        >
          <DialogHeader className={mediaModal?.type === "image" ? "space-y-0 pb-0" : undefined}>
            <DialogTitle className={mediaModal?.type === "image" ? "text-base" : undefined}>
              {mediaModal?.type === "image" ? "🖼️ Fotoğraf Ekle" : "🎬 Video Yükleme Rehberi"}
            </DialogTitle>
          </DialogHeader>
          <div className={cn(mediaModal?.type === "image" ? "py-0" : "space-y-4 py-2")}>
            {mediaModal?.type === "image" ? (
              <div className="space-y-2">
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  disabled={imageUploading}
                  onChange={onImageFileInputChange}
                />
                <div
                  role="presentation"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={onImageDrop}
                  className={cn(
                    "rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground transition-colors",
                    imageUploading && "pointer-events-none opacity-70",
                  )}
                >
                  {imageUploading ? (
                    <p className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      {imageUploadBatchTotal > 1
                        ? `${imageUploadBatchTotal} fotoğraf yükleniyor…`
                        : "Yükleniyor…"}
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 leading-snug">
                        Görselleri buraya sürükleyip bırakın veya birden fazla dosya seçin.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={imageUploading}
                        onClick={() => imageFileInputRef.current?.click()}
                      >
                        Cihazdan seç
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
                <p>
                  Sunucu hızımızı korumak için doğrudan video yüklemeyi kapattık.
                </p>
                <p>
                  Videonuzun boyutuna ve süresine göre aşağıdaki servislerden birine yükleme yapıp, aldığınız linki{" "}
                  <strong className="font-semibold text-foreground">&quot;Link Ekle&quot;</strong> aracıyla
                  entry&apos;nize ekleyebilirsiniz.
                </p>
                <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">
                  <li className="pl-1">
                    <strong className="font-semibold text-foreground">200 MB Altı Videolar İçin</strong>{" "}
                    <span className="font-normal text-muted-foreground text-sm">(Kalıcı yükleme)</span>
                    {" — "}
                    <a
                      href="https://catbox.moe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      catbox.moe
                    </a>
                  </li>
                  <li className="pl-1">
                    <strong className="font-semibold text-foreground">
                      MB Sınırı yok, 10 Dakika altındaki Videolar için
                    </strong>{" "}
                    <span className="font-normal text-muted-foreground text-sm">(90 Gün Sonra Silinir)</span>
                    {" — "}
                    <a
                      href="https://streamable.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      streamable.com
                    </a>
                  </li>
                  <li className="pl-1">
                    <strong className="font-semibold text-foreground">Sınırsız</strong>{" "}
                    <span className="font-normal text-muted-foreground text-sm">
                      (Videonuzu &quot;Liste dışı&quot; olarak yüklerseniz sadece linke tıklayanlar erişebilir. Kanal
                      isminizin görünür olacağını unutmayın)
                    </span>
                    {" — "}
                    <a
                      href="https://www.youtube.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      youtube.com
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className={mediaModal?.type === "image" ? "mt-2 gap-2 sm:mt-2" : undefined}>
            <Button
              variant="outline"
              size={mediaModal?.type === "image" ? "sm" : "default"}
              disabled={imageUploading}
              onClick={closeMediaModal}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
