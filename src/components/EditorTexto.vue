<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  minHeight: { type: String, default: '240px' },
})
const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none px-4 py-3 focus:outline-none',
    },
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

function nivelAtual() {
  if (!editor.value) return '0'
  if (editor.value.isActive('heading', { level: 1 })) return '1'
  if (editor.value.isActive('heading', { level: 2 })) return '2'
  if (editor.value.isActive('heading', { level: 3 })) return '3'
  return '0'
}

function aplicarNivel(e) {
  const v = e.target.value
  if (v === '0') editor.value.chain().focus().setParagraph().run()
  else editor.value.chain().focus().setHeading({ level: parseInt(v) }).run()
}

// Sincroniza quando o valor externo muda (ex: limpar formulário)
watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val ?? '', false)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-600 focus-within:border-transparent">
    <!-- Barra de ferramentas -->
    <div v-if="editor" class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">

      <!-- Desfazer / Refazer -->
      <button type="button" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()"
        class="toolbar-btn" title="Desfazer (Ctrl+Z)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()"
        class="toolbar-btn" title="Refazer (Ctrl+Y)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
        </svg>
      </button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Títulos -->
      <select
        class="text-xs rounded border border-gray-200 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-600 text-gray-600"
        :value="nivelAtual()"
        @change="aplicarNivel"
      >
        <option value="0">Parágrafo</option>
        <option value="1">Título 1</option>
        <option value="2">Título 2</option>
        <option value="3">Título 3</option>
      </select>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Negrito / Itálico / Sublinhado / Tachado -->
      <button type="button" @click="editor.chain().focus().toggleBold().run()"
        :class="editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : ''"
        class="toolbar-btn font-bold" title="Negrito (Ctrl+B)">B</button>
      <button type="button" @click="editor.chain().focus().toggleItalic().run()"
        :class="editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : ''"
        class="toolbar-btn italic" title="Itálico (Ctrl+I)">I</button>
      <button type="button" @click="editor.chain().focus().toggleUnderline().run()"
        :class="editor.isActive('underline') ? 'bg-gray-200 text-gray-900' : ''"
        class="toolbar-btn underline" title="Sublinhado (Ctrl+U)">U</button>
      <button type="button" @click="editor.chain().focus().toggleStrike().run()"
        :class="editor.isActive('strike') ? 'bg-gray-200 text-gray-900' : ''"
        class="toolbar-btn line-through text-sm" title="Tachado">S</button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Alinhamento -->
      <button type="button" @click="editor.chain().focus().setTextAlign('left').run()"
        :class="editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Alinhar à esquerda">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M3 10h12M3 14h18M3 18h12"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().setTextAlign('center').run()"
        :class="editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Centralizar">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M6 10h12M3 14h18M6 18h12"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().setTextAlign('right').run()"
        :class="editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Alinhar à direita">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M9 10h12M3 14h18M9 18h12"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().setTextAlign('justify').run()"
        :class="editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Justificar">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M3 10h18M3 14h18M3 18h18"/>
        </svg>
      </button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Listas -->
      <button type="button" @click="editor.chain().focus().toggleBulletList().run()"
        :class="editor.isActive('bulletList') ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Lista com marcadores">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          <circle cx="1.5" cy="6" r="1" fill="currentColor"/>
          <circle cx="1.5" cy="10" r="1" fill="currentColor"/>
          <circle cx="1.5" cy="14" r="1" fill="currentColor"/>
          <circle cx="1.5" cy="18" r="1" fill="currentColor"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().toggleOrderedList().run()"
        :class="editor.isActive('orderedList') ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Lista numerada">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01"/>
        </svg>
      </button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Blockquote / Código -->
      <button type="button" @click="editor.chain().focus().toggleBlockquote().run()"
        :class="editor.isActive('blockquote') ? 'bg-gray-200' : ''"
        class="toolbar-btn" title="Citação">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 17h3l2-4V7h-6v6h3M6 17h3l2-4V7H5v6h3z"/>
        </svg>
      </button>
      <button type="button" @click="editor.chain().focus().toggleCode().run()"
        :class="editor.isActive('code') ? 'bg-gray-200' : ''"
        class="toolbar-btn font-mono text-xs" title="Código inline">&lt;/&gt;</button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Separador horizontal -->
      <button type="button" @click="editor.chain().focus().setHorizontalRule().run()"
        class="toolbar-btn" title="Linha horizontal">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 12h16"/>
        </svg>
      </button>

      <div class="w-px h-5 bg-gray-300 mx-1"></div>

      <!-- Limpar formatação -->
      <button type="button" @click="editor.chain().focus().clearNodes().unsetAllMarks().run()"
        class="toolbar-btn" title="Limpar formatação">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L17.94 6M4 6h9m4 12H9.5"/>
        </svg>
      </button>
    </div>

    <!-- Área de edição -->
    <EditorContent :editor="editor" :style="{ minHeight: props.minHeight }" />
  </div>
</template>

<style scoped>
.toolbar-btn {
  @apply p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm leading-none select-none;
}

/* Estilos do conteúdo do editor */
:deep(.ProseMirror) {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #374151;
  outline: none;
}
:deep(.ProseMirror p) { margin-bottom: 0.5rem; }
:deep(.ProseMirror h1) { font-size: 1.4rem; font-weight: 700; margin: 1rem 0 0.5rem; }
:deep(.ProseMirror h2) { font-size: 1.2rem; font-weight: 700; margin: 0.875rem 0 0.4rem; }
:deep(.ProseMirror h3) { font-size: 1rem; font-weight: 700; margin: 0.75rem 0 0.3rem; }
:deep(.ProseMirror ul) { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
:deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
:deep(.ProseMirror blockquote) { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 0.5rem 0; }
:deep(.ProseMirror code) { background: #f3f4f6; border-radius: 0.25rem; padding: 0.1rem 0.3rem; font-family: monospace; font-size: 0.8em; }
:deep(.ProseMirror pre) { background: #1f2937; color: #f9fafb; border-radius: 0.5rem; padding: 0.75rem 1rem; overflow-x: auto; margin-bottom: 0.5rem; }
:deep(.ProseMirror hr) { border: none; border-top: 2px solid #e5e7eb; margin: 1rem 0; }
:deep(.ProseMirror table) { border-collapse: collapse; width: 100%; margin-bottom: 0.5rem; }
:deep(.ProseMirror th),
:deep(.ProseMirror td) { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; text-align: left; }
:deep(.ProseMirror th) { background: #f9fafb; font-weight: 600; }
:deep(.ProseMirror .is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
