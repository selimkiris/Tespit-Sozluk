"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface EntryFormProps {
  topicId: string
  onSubmit: (content: string) => void | Promise<void>
  isLoggedIn: boolean
  onLoginClick: () => void
}

export function EntryForm({ topicId, onSubmit, isLoggedIn, onLoginClick }: EntryFormProps) {
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!content.trim()) return

    setIsSubmitting(true)
    setError("")
    try {
      await onSubmit(content)
      setContent("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entry eklenemedi")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-muted-foreground mb-3">
          Bu başlığa entry girmek için giriş yapmalısınız.
        </p>
        <Button
          onClick={onLoginClick}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          Giriş Yap
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <Textarea
        placeholder="düşüncelerinizi yazın..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      <div className="flex justify-end pt-3 border-t border-border/50 mt-3">
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSubmitting ? "Gönderiliyor..." : "Gönder"}
        </Button>
      </div>
    </div>
  )
}
