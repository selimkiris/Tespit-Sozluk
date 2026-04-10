import Link from "@tiptap/extension-link"

/**
 * Varsayılan Link, autolink açıkken inclusive=true kullanır; imleç link sonundayken
 * yazılan yeni karakterler mark'a dahil olur ("bleeding"). Editörde her zaman inclusive=false.
 */
export const EditorLink = Link.extend({
  inclusive: () => false,
})
