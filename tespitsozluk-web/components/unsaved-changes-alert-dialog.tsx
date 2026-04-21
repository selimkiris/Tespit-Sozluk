"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const DEFAULT_TITLE = "Yapılan Değişiklikler Kaydedilmedi"
const DEFAULT_DESCRIPTION =
  "Yazdıklarınız kaydedilmedi. Çıkmadan önce ne yapmak istersiniz?"

type ComposePublishProps = {
  mode: "compose-publish"
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onDiscard: () => void
  onSaveDraft: () => void | Promise<void>
  onPublish: () => void | Promise<void>
  publishDisabled?: boolean
  saveDraftDisabled?: boolean
  isPublishing?: boolean
  isSavingDraft?: boolean
}

type EntryEditProps = {
  mode: "entry-edit"
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onDiscard: () => void
  onPublish: () => void | Promise<void>
  publishDisabled?: boolean
  isPublishing?: boolean
}

type DraftProps = {
  mode: "draft"
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onDiscard: () => void
  onSave: () => void | Promise<void>
  saveDisabled?: boolean
  isSaving?: boolean
}

export type UnsavedChangesAlertDialogProps =
  | ComposePublishProps
  | EntryEditProps
  | DraftProps

export function UnsavedChangesAlertDialog(props: UnsavedChangesAlertDialogProps) {
  const title = props.title ?? DEFAULT_TITLE
  const description = props.description ?? DEFAULT_DESCRIPTION

  const anyBusy =
    props.mode === "compose-publish"
      ? Boolean(props.isPublishing || props.isSavingDraft)
      : props.mode === "entry-edit"
        ? Boolean(props.isPublishing)
        : Boolean(props.isSaving)

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent
        className={cn(
          "max-w-[calc(100%-2rem)] sm:max-w-md gap-5 border-border/80 bg-card/95 shadow-xl backdrop-blur-sm",
        )}
      >
        <AlertDialogHeader className="space-y-2 text-left">
          <AlertDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch sm:space-x-0">
          <AlertDialogCancel
            disabled={anyBusy}
            className="w-full border-border/80 mt-0 sm:mt-0"
          >
            Vazgeç
          </AlertDialogCancel>

          {props.mode === "compose-publish" && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-border/80"
              disabled={anyBusy || props.saveDraftDisabled}
              onClick={() => void props.onSaveDraft()}
            >
              {props.isSavingDraft && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
              )}
              Taslak Olarak Kaydet
            </Button>
          )}

          {(props.mode === "compose-publish" || props.mode === "entry-edit") && (
            <Button
              type="button"
              className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
              disabled={anyBusy || !!props.publishDisabled}
              onClick={() => void props.onPublish()}
            >
              {props.isPublishing && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Paylaş
            </Button>
          )}

          {props.mode === "draft" && (
            <Button
              type="button"
              className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
              disabled={anyBusy || props.saveDisabled}
              onClick={() => void props.onSave()}
            >
              {props.isSaving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Kaydet
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={anyBusy}
            onClick={() => {
              props.onDiscard()
              props.onOpenChange(false)
            }}
          >
            Değişiklikleri Sil
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
