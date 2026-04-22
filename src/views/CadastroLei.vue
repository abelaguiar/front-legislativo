<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'
import EditorTexto from '../components/EditorTexto.vue'
import AppHeader from '../components/AppHeader.vue'

const router = useRouter()

const salvando = ref(false)
const erro = ref(null)
const temas = ref([])
const anexosPendentes = ref([])
const arrastando = ref(false)
const tiposLei = ref([
  { id_tipo_lei: 1, nome: 'Emenda Constitucional', sigla: 'EC' },
  { id_tipo_lei: 2, nome: 'Lei Complementar', sigla: 'LC' },
  { id_tipo_lei: 3, nome: 'Lei Ordinária', sigla: 'LO' },
  { id_tipo_lei: 5, nome: 'Projeto de Lei', sigla: 'PL' },
])

const form = ref({
  id_tipo_lei: '',
  numero: '',
  ano: new Date().getFullYear(),
  autor: '',
  data_doe: '',
  ementa: '',
  texto_integral: '',
  data_publicacao: '',
  notas_revisao: '',
  temas: [],
})

onMounted(async () => {
  try {
    temas.value = await api.temas.listar()
  } catch {}
})

function toggleTema(id) {
  const idx = form.value.temas.indexOf(id)
  if (idx === -1) form.value.temas.push(id)
  else form.value.temas.splice(idx, 1)
}

function selecionarArquivos(event) {
  Array.from(event.target.files).forEach(adicionarArquivo)
  event.target.value = ''
}

function onDrop(event) {
  arrastando.value = false
  Array.from(event.dataTransfer.files).forEach(adicionarArquivo)
}

function adicionarArquivo(file) {
  const duplicado = anexosPendentes.value.some(a => a.file.name === file.name && a.file.size === file.size)
  if (!duplicado) anexosPendentes.value.push({ file, nome: file.name })
}

function removerAnexo(idx) {
  anexosPendentes.value.splice(idx, 1)
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconeArquivo(nome) {
  const ext = nome.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['xls', 'xlsx'].includes(ext)) return 'excel'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'imagem'
  return 'generico'
}

async function salvar() {
  salvando.value = true
  erro.value = null
  try {
    const lei = await api.leis.criar(form.value)
    const versaoId = lei.versao_atual?.id_versao
    if (versaoId && anexosPendentes.value.length > 0) {
      for (const anexo of anexosPendentes.value) {
        const fd = new FormData()
        fd.append('arquivo', anexo.file)
        fd.append('nome', anexo.nome)
        await api.anexos.upload(versaoId, fd)
      }
    }
    router.push({ name: 'edicao-lei', params: { id: lei.id_lei } })
  } catch (e) {
    erro.value = e.message
    salvando.value = false
  }
}

function cancelar() {
  router.push({ name: 'lista-leis' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <AppHeader />

    <main class="max-w-5xl mx-auto px-6 py-6">
      <!-- Breadcrumb -->
      <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">
        <span class="hover:underline cursor-pointer" @click="cancelar">Atos normativos</span>
        <span class="mx-1">/</span>
        <span class="text-gray-600 font-medium">Novo cadastro</span>
      </p>

      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Nova Lei</h2>
          <p class="text-sm text-gray-500 mt-0.5">Preencha os dados abaixo para registrar um novo ato normativo.</p>
        </div>
        <div class="flex gap-3">
          <button @click="cancelar" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">
            Cancelar
          </button>
          <button
            @click="salvar"
            :disabled="salvando"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            <svg v-if="salvando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Salvar
          </button>
        </div>
      </div>

      <div v-if="erro" class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {{ erro }}
      </div>

      <!-- Dados Básicos -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-5">
        <div class="flex items-center gap-2 mb-5">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="font-semibold text-gray-800">Dados Básicos</h3>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número</label>
            <input v-model="form.numero" type="text" placeholder="16.245"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ano</label>
            <input v-model.number="form.ano" type="number"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Ato</label>
            <select v-model.number="form.id_tipo_lei"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
              <option value="">Selecione...</option>
              <option v-for="t in tiposLei" :key="t.id_tipo_lei" :value="t.id_tipo_lei">{{ t.nome }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Autor</label>
            <input v-model="form.autor" type="text" placeholder="Executivo Municipal"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data DOE</label>
            <input v-model="form.data_doe" type="date"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data de Publicação</label>
          <input v-model="form.data_publicacao" type="date"
            class="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        </div>

        <!-- Temas -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Temas Relacionados</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tema in temas"
              :key="tema.id_tema"
              type="button"
              @click="toggleTema(tema.id_tema)"
              :class="form.temas.includes(tema.id_tema)
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'"
              class="inline-flex items-center gap-1 text-xs font-medium border rounded-full px-3 py-1 transition"
            >
              {{ tema.nome }}
              <svg v-if="form.temas.includes(tema.id_tema)" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Ementa -->
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ementa</label>
          <textarea v-model="form.ementa" rows="3" placeholder="Dispõe sobre..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"></textarea>
        </div>
      </div>

      <!-- Conteúdo -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-5">
        <div class="flex items-center gap-2 mb-5">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <h3 class="font-semibold text-gray-800">Texto da Lei</h3>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Texto Integral</label>
          <EditorTexto v-model="form.texto_integral" />
        </div>
        <div class="mt-4">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas de Revisão</label>
          <input v-model="form.notas_revisao" type="text" placeholder="Observações internas..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        </div>
      </div>

      <!-- Anexos -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-5">
        <div class="flex items-center gap-2 mb-5">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
          </svg>
          <h3 class="font-semibold text-gray-800">Anexos</h3>
          <span class="text-xs text-gray-400 font-normal">Os arquivos serão vinculados à versão inicial da lei após salvar.</span>
        </div>

        <!-- Área de drop -->
        <div
          @dragover.prevent="arrastando = true"
          @dragleave.prevent="arrastando = false"
          @drop.prevent="onDrop"
          :class="arrastando ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'"
          class="relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition cursor-pointer"
          @click="$refs.inputArquivo.click()"
        >
          <svg class="w-9 h-9 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">Arraste arquivos aqui ou <span class="text-green-700 underline">clique para selecionar</span></p>
            <p class="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, XLS, XLSX, imagens — sem limite de quantidade</p>
          </div>
          <input ref="inputArquivo" type="file" multiple class="hidden" @change="selecionarArquivos" />
        </div>

        <!-- Lista de arquivos pendentes -->
        <div v-if="anexosPendentes.length > 0" class="mt-4 space-y-2">
          <div
            v-for="(anexo, idx) in anexosPendentes"
            :key="idx"
            class="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <!-- Ícone por tipo -->
            <div class="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              :class="{
                'bg-red-100 text-red-600': iconeArquivo(anexo.nome) === 'pdf',
                'bg-blue-100 text-blue-600': iconeArquivo(anexo.nome) === 'word',
                'bg-green-100 text-green-700': iconeArquivo(anexo.nome) === 'excel',
                'bg-purple-100 text-purple-600': iconeArquivo(anexo.nome) === 'imagem',
                'bg-gray-100 text-gray-500': iconeArquivo(anexo.nome) === 'generico',
              }">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>

            <!-- Nome editável + tamanho -->
            <div class="flex-1 min-w-0">
              <input
                v-model="anexo.nome"
                type="text"
                class="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 py-0.5"
              />
              <p class="text-xs text-gray-400 mt-0.5 px-1">{{ formatarTamanho(anexo.file.size) }}</p>
            </div>

            <!-- Remover -->
            <button @click="removerAnexo(idx)" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="Remover">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="bg-green-900 rounded-xl px-6 py-4 flex items-center justify-between">
        <p class="text-xs text-green-300">Preencha todos os campos obrigatórios antes de salvar.</p>
        <button
          @click="salvar"
          :disabled="salvando"
          class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-white text-green-900 rounded-lg hover:bg-green-50 disabled:opacity-50 transition"
        >
          <svg v-if="salvando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Salvar
        </button>
      </div>
    </main>
  </div>
</template>
