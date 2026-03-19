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
import { getApiUrl, getAuthHeaders } from "@/lib/api"

type FollowUser = {
  id: string
  username: string
  avatar?: string | null
}

type FollowListModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  mode: "followers" | "following"
}

export function FollowListModal({
  open,
  onOpenChange,
  userId,
  mode,
}: FollowListModalProps) {
  const title = mode === "followers" ? "Takipçiler" : "Takip Edilenler"

  const [users, setUsers] = React.useState<FollowUser[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !userId) return
    const endpoint =
      mode === "followers"
        ? `api/Users/${userId}/followers`
        : `api/Users/${userId}/following`
    setLoading(true)
    fetch(getApiUrl(endpoint), { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FollowUser[]) => {
        setUsers(
          Array.isArray(data)
            ? data.map((u) => ({
                id: String(u.id),
                username: u.username ?? "Anonim",
                avatar: u.avatar ?? null,
              }))
            : []
        )
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [open, userId, mode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">
              Yükleniyor...
            </p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {mode === "followers" ? "Henüz takipçi yok." : "Henüz takip edilen yok."}
            </p>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/user/${u.id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60 transition-colors"
                  >
                    {u.avatar?.startsWith("http") ? (
                      <img src={u.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover border border-border" />
                    ) : u.avatar ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-xl border border-border">
                        {u.avatar}
                      </span>
                    ) : (
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(u.username || "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-medium text-foreground truncate">
                      {u.username}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
