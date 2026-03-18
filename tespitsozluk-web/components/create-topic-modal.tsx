"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const TITLE_MAX_LENGTH = 70

interface CreateTopicModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (title: string, firstEntry: string) => void | Promise<string | null>
  isLoggedIn: boolean
  onLoginClick: () => void
}

export function CreateTopicModal({
  isOpen,
  onClose,
  onCreate,
  isLoggedIn,
  onLoginClick,
}: CreateTopicModalProps) {
  const [title, setTitle] = useState("")
  const [firstEntry, setFirstEntry] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !firstEntry.trim() || title.length > TITLE_MAX_LENGTH) return

    setIsLoading(true)
    setError("")
    try {
      await onCreate(title, firstEntry)
      setTitle("")
      setFirstEntry("")
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-card border border-border rounded-xl shadow-lg p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Yeni Başlık</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Yeni başlık oluşturmak için giriş yapmalısınız.
            </p>
            <Button
              onClick={() => {
                onClose()
                onLoginClick()
              }}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Giriş Yap
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-title" className="text-sm text-foreground">
                Başlık
              </Label>
              <Input
                id="topic-title"
                type="text"
                placeholder="başlık adı"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                required
                maxLength={TITLE_MAX_LENGTH}
                className="h-10 bg-secondary/50 border-border focus:border-ring"
              />
              <div className="flex items-center justify-between">
                <span className={`text-xs ${title.length > TITLE_MAX_LENGTH ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {title.length > TITLE_MAX_LENGTH ? "Başlık en fazla 70 karakter olabilir." : `${title.length}/${TITLE_MAX_LENGTH}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-entry" className="text-sm text-foreground">
                İlk Entry
              </Label>
              <Textarea
                id="first-entry"
                placeholder="düşüncelerinizi yazın..."
                value={firstEntry}
                onChange={(e) => setFirstEntry(e.target.value)}
                required
                className="min-h-[120px] bg-secondary/50 border-border focus:border-ring resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={!title.trim() || !firstEntry.trim() || title.length > TITLE_MAX_LENGTH || isLoading}
              className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? "Oluşturuluyor..." : "Başlık Oluştur"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
