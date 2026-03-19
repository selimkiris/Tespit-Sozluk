"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
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
  MessageSquareWarning,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import { toast } from "sonner"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"

const CHAR_LIMIT = 100_000
const CHAR_WARN_THRESHOLD = 95_000
const CHAR_DANGER_THRESHOLD = 99_000

interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  onCharCountChange?: (count: number) => void
}

function ensureHtml(value: string): string {
  if (!value || !value.trim()) return ""
  if (value.trim().startsWith("<")) return value
  return `<p>${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
}

export function RichTextEditor({ value, onChange, placeholder, onCharCountChange }: RichTextEditorProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [mediaModal, setMediaModal] = useState<{ type: "image" | "video" } | null>(null)
  const [linkData, setLinkData] = useState({ text: "", url: "" })
  const [charCount, setCharCount] = useState(0)
  const charCountRef = useRef(0)

  const updateCharCount = useCallback((count: number) => {
    charCountRef.current = count
    setCharCount(count)
    onCharCountChange?.(count)
  }, [onCharCountChange])

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
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-emerald-600 dark:text-emerald-400 hover:underline",
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
        class:
          "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none min-h-[80px] px-1 py-2 text-foreground",
      },
      handleKeyDown: (_view, event) => {
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
    editor.chain().focus().insertContent(`<a href="${safeUrl}" title="${safeUrl}" target="_blank" class="text-blue-500 hover:underline">${displayText}</a> `).run()
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

  const addEksiSpoiler = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const rawText = editor.state.doc.textBetween(from, to, " ")
    if (!rawText) {
      toast.error("Lütfen spoiler içine alınacak metni seçin.")
      return
    }
    const text = rawText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    editor.chain().focus().deleteSelection().insertContent(`<blockquote><p><strong class="text-red-500">--- spoiler ---</strong></p><p>${text}</p><p><strong class="text-red-500">--- spoiler ---</strong></p></blockquote><p></p>`).run()
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
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
          <PopoverContent className="w-auto p-0 border-0" align="start">
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
        <ToolbarButton
          onClick={addEksiSpoiler}
          title="Yazılı Spoiler"
        >
          <MessageSquareWarning className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="relative">
        <EditorContent editor={editor} />
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
              <>
                <p className="text-sm text-muted-foreground">
                  🖼️ Fotoğraf Yükleme Rehberi: Sunucu hızımızı korumak için doğrudan fotoğraf yüklemeyi kapattık. Lütfen fotoğrafınızı aşağıdaki adrese yükleyin ve aldığınız linki &quot;Link Ekle&quot; aracıyla entry&apos;nize ekleyin.
                </p>
                <Input
                  readOnly
                  value="https://imgbb.com/"
                  className="font-mono bg-muted/50 cursor-text select-all"
                />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  🎬 Video Yükleme Rehberi: Videonuzun boyutuna göre aşağıdaki servislerden birine yükleme yapıp, aldığınız linki &quot;Link Ekle&quot; aracıyla entry&apos;nize ekleyebilirsiniz.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">200 MB Altı Videolar İçin (Kalıcı):</Label>
                    <Input
                      readOnly
                      value="https://catbox.moe/"
                      className="font-mono bg-muted/50 cursor-text select-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">200 MB Üstü Videolar İçin (90 Gün Sonra Silinir):</Label>
                    <Input
                      readOnly
                      value="https://streamable.com/"
                      className="font-mono bg-muted/50 cursor-text select-all"
                    />
                  </div>
                </div>
              </>
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
