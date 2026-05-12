"use client"

import { useState, useLayoutEffect, useRef } from "react"

import { HtmlRenderer } from "@/components/html-renderer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExpandableHtmlContentProps {
  html: string
  className?: string
  rendererClassName?: string
  /**
   * Kaç görsel satırdan sonra "Devamını oku" gelsin.
   * Karakter değil; tarayıcının render ettiği gerçek satır sayısı.
   */
  maxLines?: number
  /** Entry gövdesi arama vurgusu (HtmlRenderer). */
  searchHighlightQuery?: string
}

export function ExpandableHtmlContent({
  html,
  className,
  rendererClassName,
  maxLines = 11,
  searchHighlightQuery,
}: ExpandableHtmlContentProps) {
  const [expanded, setExpanded] = useState(false)

  /**
   * clampHeight: İçeriğin kırpılacağı piksel yüksekliği.
   * null ise içerik 11 satırdan kısa demektir — hiç kırpma yapılmaz.
   */
  const [clampHeight, setClampHeight] = useState<number | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)

  /**
   * useLayoutEffect: Normal useEffect'ten farkı, tarayıcı ekrana boyamadan (paint)
   * ÖNCE çalışır. Bu sayede:
   *   1. Tüm HTML DOM'a yazılır.
   *   2. Yükseklik ölçülür.
   *   3. Gerekiyorsa max-height state'i güncellenir.
   *   4. React tekrar render eder ve max-height uygulanır.
   *   5. Tarayıcı ancak ondan sonra boyar.
   * Kullanıcı asla "anlık genişleyip kapanma" görmez.
   *
   * Cursor'ın başarısız olmasının asıl sebebi: o hep metin kırpma fonksiyonunu
   * düzelttirmeye çalıştı, ama sorun "kaç karakter" değil "kaç piksel" sorusuydu.
   * Pikseli ancak tarayıcı söyleyebilir, bu yüzden DOM ölçümü şart.
   */
  useLayoutEffect(() => {
    // İçerik değiştiğinde "daraltılmış" moddan çık
    setExpanded(false)

    const el = contentRef.current
    if (!el) return

    /**
     * getComputedStyle ile tarayıcının bu element için hesapladığı
     * gerçek line-height değerini okuyoruz (piksel cinsinden).
     * CSS'de "1.6em" veya "normal" yazıyor olsa bile tarayıcı onu
     * her zaman piksel olarak döndürür.
     */
    const computedLineHeight = parseFloat(getComputedStyle(el).lineHeight)
    // Eğer "normal" gibi sayısal olmayan bir değer geldiyse (NaN), güvenli
    // bir varsayılan olarak 24px kullan (çoğu body metni için makul).
    const lineHeight = isNaN(computedLineHeight) ? 24 : computedLineHeight

    // Eşik: 11 satır × line-height = içeriğin görünür kalacağı max piksel
    const threshold = maxLines * lineHeight

    /**
     * scrollHeight: "overflow: hidden" olsa bile tüm içeriğin gerçek
     * piksel yüksekliğini verir. Yani kırpılmış içeriği de sayar.
     * Bu özellik sayesinde max-height uygulanmış olsa bile doğru ölçüm
     * alabiliyoruz — bu Cursor'ın kaçırdığı kritik nokta.
     */
    const fullHeight = el.scrollHeight

    if (fullHeight > threshold) {
      // İçerik 11 satırı aşıyor: tam eşik pikselinde kırp
      setClampHeight(threshold)
    } else {
      // İçerik 11 satırdan kısa: hiçbir şey yapma, buton gösterme
      setClampHeight(null)
    }
  }, [html, maxLines]) // Sadece içerik veya satır limiti değişince yeniden ölç

  const isClamped = clampHeight !== null

  return (
    <div className={cn("min-w-0 w-full max-w-full overflow-x-hidden", className)}>
      <div
        ref={contentRef}
        className="entry-text min-w-0 w-full max-w-full"
        style={
          // Kırpma sadece "isClamped=true" ve kullanıcı henüz açmamışsa çalışır.
          // Expanded=true olunca style kaldırılır, içerik tam boy görünür.
          isClamped && !expanded
            ? { maxHeight: `${clampHeight}px`, overflow: "hidden" }
            : undefined
        }
      >
        <HtmlRenderer
          html={html}
          className={rendererClassName}
          searchHighlightQuery={searchHighlightQuery}
        />
      </div>

      {/* Buton sadece içerik gerçekten 11 satırı aşıyorsa görünür */}
      {isClamped && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="entry-read-more-link h-auto px-0 py-0 text-[#8a8d96] italic text-sm hover:text-[#a0a3ab] transition-colors duration-150 hover:bg-transparent"
            style={{ color: "#8a8d96", fontStyle: "italic", fontSize: "14px" }}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Daralt" : "Devamını oku"}
          </Button>
        </div>
      )}
    </div>
  )
}
