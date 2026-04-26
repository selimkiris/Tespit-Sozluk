"use client"

import Link from "next/link"
import { EntryCard } from "@/components/entry-card"
import type { ApiPollDto } from "@/lib/entry-poll"

type ApiEntry = {
  id: string
  topicId: string
  topicTitle: string
  content: string
  authorId: string
  authorName: string
  authorAvatar?: string | null
  authorRole?: string
  createdAt: string
  updatedAt?: string | null
  upvotes: number
  downvotes: number
  userVoteType?: number
  validBkzs?: Record<string, string> | null
  isAnonymous?: boolean
  canManage?: boolean
  saveCount?: number
  isSavedByCurrentUser?: boolean
  poll?: ApiPollDto | null
}

function mapApiEntryToCard(e: ApiEntry) {
  const userVote: "up" | "down" | null =
    e.userVoteType === 1 ? "up" : e.userVoteType === -1 ? "down" : null
  return {
    id: String(e.id),
    topicId: String(e.topicId),
    topicTitle: e.topicTitle ?? "",
    content: e.content,
    author: { id: String(e.authorId), nickname: e.authorName, avatar: e.authorAvatar ?? null, role: e.authorRole ?? "User" },
    date: e.createdAt,
    updatedAt: e.updatedAt ?? null,
    upvotes: e.upvotes,
    downvotes: e.downvotes,
    userVote,
    validBkzs: e.validBkzs ?? null,
    isAnonymous: e.isAnonymous ?? false,
    canManage: e.canManage ?? false,
    saveCount: e.saveCount ?? 0,
    isSavedByCurrentUser: e.isSavedByCurrentUser ?? false,
    poll: e.poll ?? null,
  }
}

interface EntryDetailProps {
  entry: ApiEntry
  isLoggedIn?: boolean
  currentUser?: { id: string } | null
  onLoginClick?: () => void
  onTopicClick?: (topicId: string) => void
  onVoteSuccess?: () => void
  onEntryChange?: () => void
}

export function EntryDetail({
  entry,
  isLoggedIn = false,
  currentUser,
  onLoginClick,
  onTopicClick,
  onVoteSuccess,
  onEntryChange,
}: EntryDetailProps) {
  const mapped = mapApiEntryToCard(entry)

  return (
    <div className="space-y-4">
      <Link
        href={`/?topic=${entry.topicId}`}
        onClick={(e) => {
          if (onTopicClick) {
            e.preventDefault()
            onTopicClick(entry.topicId)
          }
        }}
        className="block text-slate-200 dark:text-slate-300 text-xl font-bold leading-[1.35] tracking-[-0.01em] break-words whitespace-pre-wrap hover:underline underline-offset-2 pb-2"
      >
        {entry.topicTitle}
      </Link>
      <EntryCard
        entry={mapped}
        showTopicTitle={false}
        isLoggedIn={isLoggedIn}
        onLoginClick={onLoginClick}
        onVoteSuccess={onVoteSuccess}
        currentUser={currentUser}
        onEntryChange={onEntryChange}
        onTopicClick={onTopicClick}
      />
    </div>
  )
}
