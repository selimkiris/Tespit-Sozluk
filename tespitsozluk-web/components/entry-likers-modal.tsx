"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { fetchEntryUpvoters, type EntryUpvoterUser } from "@/lib/api"

type EntryLikersModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: string
}

function displayName(u: EntryUpvoterUser): string {
  const s = (u.username?.trim() || u.name?.trim() || "").trim()
  return s || "Kullanıcı"
}

export function EntryLikersModal({
  open,
  onOpenChange,
  entryId,
}: EntryLikersModalProps) {
  const [users, setUsers] = React.useState<EntryUpvoterUser[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !entryId) return
    setLoading(true)
    setError(null)
    fetchEntryUpvoters(entryId)
      .then(setUsers)
      .catch(() => {
        setUsers([])
        setError("Liste yüklenemedi. Oturumunuzu kontrol edip tekrar deneyin.")
      })
      .finally(() => setLoading(false))
  }, [open, entryId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kalp atanlar</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Yükleniyor...</p>
          ) : error ? (
            <p className="text-center text-destructive/90 py-6 text-sm">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Henüz kalp atan yok.</p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => {
                const label = displayName(u)
                return (
                  <li key={u.id}>
                    <Link
                      href={`/user/${u.id}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors"
                    >
                      {u.avatar?.startsWith("http") ? (
                        <img
                          src={u.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 shrink-0 rounded-full object-cover border border-border"
                        />
                      ) : u.avatar ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-xl border border-border">
                          {u.avatar}
                        </span>
                      ) : (
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {label.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="font-medium text-foreground max-w-[200px] truncate">{label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
