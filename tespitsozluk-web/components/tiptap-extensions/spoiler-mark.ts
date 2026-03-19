import { Mark, mergeAttributes } from "@tiptap/core"

export interface SpoilerOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spoiler: {
      setSpoiler: () => ReturnType
      unsetSpoiler: () => ReturnType
      toggleSpoiler: () => ReturnType
    }
  }
}

export const SpoilerMark = Mark.create<SpoilerOptions>({
  name: "spoiler",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "spoiler",
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[class~="spoiler"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setSpoiler:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      unsetSpoiler:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
      toggleSpoiler:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.toggleSpoiler(),
    }
  },
})
