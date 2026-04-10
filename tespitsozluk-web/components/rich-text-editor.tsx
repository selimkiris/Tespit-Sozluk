"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ENTRY_BODY_RENDERER_CLASSNAME,
  ENTRY_BODY_OUTER_WRAPPER_CLASS,
  ENTRY_BODY_INNER_SCROLL_CLASS,
  ENTRY_BODY_ENTRY_TEXT_CLASS,
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
}

function ensureHtml(value: string): string {
  if (!value || !value.trim()) return ""
  if (value.trim().startsWith("<")) return value
  return `<p>${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  onCharCountChange,
  contentMinHeightClass = "min-h-[80px]",
  bodyScrollMaxHeightClass,
  innerContentPaddingClassName,
}: RichTextEditorProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [mediaModal, setMediaModal] = useState<{ type: "image" | "video" } | null>(null)
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
      }),
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
      SpoilerMark,
    ],
    content: ensureHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none max-w-none min-w-0 w-full max-w-full break-words whitespace-pre-wrap overflow-x-hidden",
          ENTRY_BODY_TIPTAP_ROOT_CLASS,
          "[&_p]:!my-0",
          "prose-a:text-emerald-500 prose-a:font-medium prose-a:no-underline prose-a:underline-offset-2 prose-a:hover:underline",
          ENTRY_BODY_RENDERER_CLASSNAME,
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
          if (event.key === "Enter" && !event.shiftKey) {
            const pick = m.results[m.selectedIndex]
            if (pick) {
              event.preventDefault()
              insertMention(pick)
              return true
            }
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
      updateCharCount(editor.getText().length)
    },
    onUpdate: ({ editor }) => {
      updateCharCount(editor.getText().length)
      onChange(editor.getHTML())
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
    const target = ensureHtml(value)
    const current = editor.getHTML()
    if (target !== current) {
      editor.commands.setContent(target, { emitUpdate: false })
    }
  }, [value, editor])

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

  const openImageGuide = useCallback(() => setMediaModal({ type: "image" }), [])
  const openVideoGuide = useCallback(() => setMediaModal({ type: "video" }), [])

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
    <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-hidden box-border min-w-0 w-full max-w-full">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1 py-1.5">
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
        <ToolbarButton onClick={openImageGuide} title="Fotoğraf Rehberi">
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
      </div>
      <div className={cn(ENTRY_BODY_OUTER_WRAPPER_CLASS, "mb-0")}>
        <div
          className={cn(
            ENTRY_BODY_INNER_SCROLL_CLASS,
            "relative whitespace-pre-wrap break-words box-border",
            bodyScrollMaxHeightClass &&
              "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
            bodyScrollMaxHeightClass
          )}
        >
          <div className={cn(ENTRY_BODY_ENTRY_TEXT_CLASS, innerContentPaddingClassName)}>
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
      <Dialog open={!!mediaModal} onOpenChange={(open) => !open && setMediaModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mediaModal?.type === "image" ? "🖼️ Fotoğraf Yükleme Rehberi" : "🎬 Video Yükleme Rehberi"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {mediaModal?.type === "image" ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sunucu hızımızı korumak için doğrudan fotoğraf yüklemeyi kapattık. Lütfen fotoğrafınızı{" "}
                <a
                  href="https://imgbb.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  imgbb.com
                </a>{" "}
                adresine yükleyin (&quot;Gömme kodları&quot; seçeneğinden &quot;Görüntüleyici bağlantıları&quot; kısmını
                seçiniz) daha sonra aldığınız linki &quot;Link Ekle&quot; aracıyla entry&apos;nize ekleyin.
              </p>
            ) : (
              <div className="text-sm text-muted-foreground leading-relaxed">
                <p>
                  Videonuzun boyutuna ve süresine göre aşağıdaki servislerden birine yükleme yapıp, aldığınız linki
                  &quot;Link Ekle&quot; aracıyla entry&apos;nize ekleyebilirsiniz.
                </p>
                <br />
                <p>
                  200 MB Altı Videolar İçin (Kalıcı yükleme) —{" "}
                  <a
                    href="https://catbox.moe"
                    target="_blank"
                    className="text-blue-500 hover:underline"
                    rel="noopener noreferrer"
                  >
                    catbox.moe
                  </a>
                </p>
                <br />
                <p>
                  MB Sınırı yok, 10 Dakika altındaki Videolar için (90 Gün Sonra Silinir) —{" "}
                  <a
                    href="https://streamable.com"
                    target="_blank"
                    className="text-blue-500 hover:underline"
                    rel="noopener noreferrer"
                  >
                    streamable.com
                  </a>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setMediaModal(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
