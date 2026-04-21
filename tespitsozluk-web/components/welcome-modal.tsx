'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  getWelcomeStorageKey,
  welcomeConfig,
} from '@/welcome.config'

type WelcomeStorageState = {
  views: number
  dontShowAgain?: boolean
}

function readState(key: string): WelcomeStorageState {
  if (typeof window === 'undefined') {
    return { views: 0 }
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { views: 0 }
    const parsed = JSON.parse(raw) as Partial<WelcomeStorageState>
    return {
      views: typeof parsed.views === 'number' && parsed.views >= 0 ? parsed.views : 0,
      dontShowAgain: parsed.dontShowAgain === true,
    }
  } catch {
    return { views: 0 }
  }
}

function writeState(key: string, next: WelcomeStorageState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

function consumeOneWelcomeIncrement(storageKey: string): boolean {
  if (typeof window === 'undefined') return true
  const w = window as Window & { __tespitWelcomeInc?: Set<string> }
  w.__tespitWelcomeInc ??= new Set()
  if (w.__tespitWelcomeInc.has(storageKey)) return false
  w.__tespitWelcomeInc.add(storageKey)
  return true
}

export function WelcomeModal() {
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [dontShowAgain, setDontShowAgain] = React.useState(false)
  const storageKey = React.useMemo(
    () => getWelcomeStorageKey(welcomeConfig.version),
    [],
  )

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    if (!welcomeConfig.isActive) return

    const current = readState(storageKey)
    if (current.dontShowAgain === true) return
    if (current.views >= welcomeConfig.maxViews) return

    let next: WelcomeStorageState = { ...current }
    if (consumeOneWelcomeIncrement(storageKey)) {
      next = { ...current, views: current.views + 1 }
      writeState(storageKey, next)
    }

    setOpen(true)
  }, [storageKey, mounted])

  const persistDontShowIfNeeded = React.useCallback(() => {
    if (!dontShowAgain) return
    const current = readState(storageKey)
    writeState(storageKey, { ...current, dontShowAgain: true })
  }, [dontShowAgain, storageKey])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        persistDontShowIfNeeded()
        setOpen(false)
      }
    },
    [persistDontShowIfNeeded],
  )

  const handleKapat = React.useCallback(() => {
    persistDontShowIfNeeded()
    setOpen(false)
  }, [persistDontShowIfNeeded])

  if (!welcomeConfig.isActive) {
    return null
  }

  if (!mounted) {
    return null
  }

  const { content, title } = welcomeConfig
  const m = content

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 pt-6 pr-14 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-7 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h3 className="text-foreground text-base font-semibold tracking-tight">
                {m.nedir.baslik}
              </h3>
              <p>{m.nedir.giris}</p>
              {m.nedir.burasi.map((p, i) => (
                <p key={`burasi-${i}`}>{p}</p>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-foreground text-base font-semibold tracking-tight">
                {m.nelerYapilir.baslik}
              </h3>
              {m.nelerYapilir.giris.map((p, i) => (
                <p key={`ny-giris-${i}`}>{p}</p>
              ))}
              <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed">
                {m.nelerYapilir.maddeler.map((text, i) => (
                  <li key={i} className="pl-0.5">
                    {text}
                  </li>
                ))}
              </ul>
              <p>{m.nelerYapilir.ozet}</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-foreground text-base font-semibold tracking-tight">
                {m.amac.baslik}
              </h3>
              {m.amac.paragraflar.map((p, i) => (
                <p key={`amac-${i}`}>{p}</p>
              ))}
              <p>{m.amac.kapanisGiris}</p>
              <p>{m.amac.kapanisVurgu}</p>
            </section>
          </div>
        </div>

        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 space-y-4 border-t px-6 py-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Checkbox
              id="welcome-dont-show"
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="welcome-dont-show"
              className="text-muted-foreground cursor-pointer text-sm leading-snug font-normal"
            >
              Bir daha gösterme
            </Label>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleKapat}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
