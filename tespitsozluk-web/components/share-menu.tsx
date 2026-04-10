"use client"

import { useState, useEffect } from "react"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ShareMenuProps {
  url: string
  title: string
  /** Ek sınıf (örn. ikon boyutu) */
  className?: string
  variant?: "default" | "ghost"
  size?: "default" | "sm" | "icon"
  /** Tarayıcı yerleşik tooltip için title attribute */
  tooltipTitle?: string
}

export function ShareMenu({
  url,
  title,
  className,
  variant = "ghost",
  size = "icon",
  tooltipTitle,
}: ShareMenuProps) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: execCommand
      const ta = document.createElement("textarea")
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTwitter = () => {
    const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=400")
  }

  const handleWhatsApp = () => {
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + url)}`
    window.open(shareUrl, "_blank", "noopener,noreferrer")
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title,
        url,
        text: title,
      })
    } catch {
      // Kullanıcı iptal etti veya hata
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`text-muted-foreground hover:text-foreground ${className ?? ""}`}
          aria-label="Paylaş"
          title={tooltipTitle}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? "Kopyalandı ✓" : "Bağlantıyı Kopyala"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTwitter} className="cursor-pointer">
          X&apos;te (Twitter) Paylaş
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          WhatsApp&apos;ta Paylaş
        </DropdownMenuItem>
        {canNativeShare && (
          <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
            Diğer Uygulamalar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
