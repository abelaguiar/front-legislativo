<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../services/api.js'

const route = useRoute()
const router = useRouter()
const leiId = Number(route.params.id)

// ─── estado principal ──────────────────────────────────────────────────────
const lei = ref(null)
const versao = ref(null)
const vinculos = ref([])
const temas = ref([])
const loading = ref(true)
const salvando = ref(false)
const erroGeral = ref(null)
const ultimaSalvagem = ref(null)

const tiposLei = [
  { id_tipo_lei: 1, nome: 'Emenda Constitucional', sigla: 'EC' },
  { id_tipo_lei: 2, nome: 'Lei Complementar', sigla: 'LC' },
  { id_tipo_lei: 3, nome: 'Lei Ordinária', sigla: 'LO' },
  { id_tipo_lei: 5, nome: 'Projeto de Lei', sigla: 'PL' },
]

// ─── formulário dados básicos ──────────────────────────────────────────────
const formLei = reactive({ id_tipo_lei: '', numero: '', ano: '', autor: '', data_doe: '', temas: [] })
const formVersao = reactive({ ementa: '', texto_integral: '', texto_alterado: '', texto_consolidado: '', data_publicacao: '', notas_revisao: '', notas_curador: '', status: 'pendente' })

// ─── modal vínculo ─────────────────────────────────────────────────────────
const modalVinculo = ref(false)
const buscaLei = ref('')
const buscaResultados = ref([])
const buscandoLei = ref(false)
const novoVinculo = reactive({
  id_lei_origem: null,
  leiOrigemLabel: '',
  tipo_vinculo: 'altera',
  trechos: [],
})
const erroVinculo = ref(null)
const salvandoVinculo = ref(false)

// ─── histórico de versões ──────────────────────────────────────────────────
const versoes = ref([])
const carregandoVersoes = ref(false)
const versoesCarregadas = ref(false)
// ─── editor texto integral ───────────────────────────────────────────────────
const editorIntegral = ref(null)
// ─── upload de anexo ───────────────────────────────────────────────────────
const inputAnexo = ref(null)
const uploadandoAnexo = ref(false)

// ─── carregar dados ────────────────────────────────────────────────────────
onMounted(async () => {
  // Carrega apenas a lei como bloqueante; vinculos/temas em segundo plano
  try {
    const leiData = await api.leis.mostrar(leiId)
    lei.value = leiData

    // popular formulário
    Object.assign(formLei, {
      id_tipo_lei: leiData.tipo_lei?.id_tipo_lei ?? '',
      numero: leiData.numero ?? '',
      ano: leiData.ano ?? '',
      autor: leiData.autor ?? '',
      data_doe: leiData.data_doe ?? '',
      temas: (leiData.temas ?? []).map(t => t.id_tema),
    })

    versao.value = leiData.versao_atual ?? null
    if (versao.value) {
      Object.assign(formVersao, {
        ementa: versao.value.ementa ?? '',
        texto_integral: versao.value.texto_integral ?? '',
        texto_alterado: versao.value.texto_alterado ?? '',
        texto_consolidado: versao.value.texto_consolidado ?? '',
        data_publicacao: versao.value.data_publicacao ?? '',
        notas_revisao: versao.value.notas_revisao ?? '',
        notas_curador: versao.value.notas_curador ?? '',
        status: versao.value.status ?? 'pendente',
      })
    }
  } catch (e) {
    erroGeral.value = e.message
  } finally {
    loading.value = false
  }

  // Popula o editor contenteditable APÓS loading=false (v-else já renderizou)
  nextTick(() => {
    if (editorIntegral.value && formVersao.texto_integral) {
      editorIntegral.value.innerHTML = formVersao.texto_integral
    }
  })

  // Carrega vínculos e temas em segundo plano (não bloqueia a tela)
  Promise.all([
    api.vinculos.listar(leiId).catch(() => []),
    api.temas.listar().catch(() => []),
  ]).then(([vinculosData, temasData]) => {
    vinculos.value = Array.isArray(vinculosData) ? vinculosData : []
    temas.value = Array.isArray(temasData) ? temasData : []
  })
})

// ─── salvar rascunho ───────────────────────────────────────────────────────
async function salvarRascunho() {
  salvando.value = true
  erroGeral.value = null
  try {
    await api.leis.atualizar(leiId, {
      id_tipo_lei: formLei.id_tipo_lei,
      numero: formLei.numero,
      ano: Number(formLei.ano),
      autor: formLei.autor || null,
      data_doe: formLei.data_doe || null,
      temas: formLei.temas,
    })
    if (versao.value) {
      await api.leis.atualizarVersao(leiId, versao.value.id_versao_lei, {
        ...formVersao,
        status: 'pendente',
      })
    }
    ultimaSalvagem.value = new Date()
    formVersao.status = 'pendente'
  } catch (e) {
    erroGeral.value = e.message
  } finally {
    salvando.value = false
  }
}

async function publicar() {
  salvando.value = true
  erroGeral.value = null
  try {
    await api.leis.atualizar(leiId, {
      id_tipo_lei: formLei.id_tipo_lei,
      numero: formLei.numero,
      ano: Number(formLei.ano),
      autor: formLei.autor || null,
      data_doe: formLei.data_doe || null,
      temas: formLei.temas,
    })
    if (versao.value) {
      await api.leis.atualizarVersao(leiId, versao.value.id_versao_lei, {
        ...formVersao,
        status: 'publicado',
      })
    }
    formVersao.status = 'publicado'
    ultimaSalvagem.value = new Date()
  } catch (e) {
    erroGeral.value = e.message
  } finally {
    salvando.value = false
  }
}

function cancelar() {
  router.push({ name: 'lista-leis' })
}

// ─── temas ─────────────────────────────────────────────────────────────────
function toggleTema(id) {
  const idx = formLei.temas.indexOf(id)
  if (idx === -1) formLei.temas.push(id)
  else formLei.temas.splice(idx, 1)
}

function temaNome(id) {
  return temas.value.find(t => t.id_tema === id)?.nome ?? ''
}

// ─── helpers ───────────────────────────────────────────────────────────────
function formatarDataHora(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d)) return val
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function tempoAtras(val) {
  if (!val) return ''
  const diff = Math.floor((Date.now() - new Date(val)) / 60000)
  if (diff < 1) return 'agora mesmo'
  if (diff === 1) return 'há 1 minuto'
  return `há ${diff} minutos`
}

// ─── busca de leis para vínculo ────────────────────────────────────────────
let buscaTimer = null
async function buscarLeis() {
  clearTimeout(buscaTimer)
  if (!buscaLei.value.trim()) { buscaResultados.value = []; return }
  buscaTimer = setTimeout(async () => {
    buscandoLei.value = true
    try {
      const res = await api.leis.listar({ 'filter[busca]': buscaLei.value.trim(), per_page: 10 })
      buscaResultados.value = (res.data ?? []).filter(l => l.id_lei !== leiId)
    } catch {}
    buscandoLei.value = false
  }, 400)
}

function selecionarLeiOrigem(l) {
  novoVinculo.id_lei_origem = l.id_lei
  novoVinculo.leiOrigemLabel = `Lei nº ${l.numero}/${l.ano}`
  buscaResultados.value = []
  buscaLei.value = novoVinculo.leiOrigemLabel
}

function adicionarTrecho() {
  novoVinculo.trechos.push({ referencia: '', texto_original: '', texto_novo: '', tipo: 'substituicao', ordem: novoVinculo.trechos.length + 1 })
}

function removerTrecho(idx) {
  novoVinculo.trechos.splice(idx, 1)
  novoVinculo.trechos.forEach((t, i) => { t.ordem = i + 1 })
}

function abrirModalVinculo() {
  Object.assign(novoVinculo, { id_lei_origem: null, leiOrigemLabel: '', tipo_vinculo: 'altera', trechos: [] })
  buscaLei.value = ''
  buscaResultados.value = []
  erroVinculo.value = null
  modalVinculo.value = true
}

async function salvarVinculo() {
  if (!novoVinculo.id_lei_origem) { erroVinculo.value = 'Selecione a lei de origem.'; return }
  salvandoVinculo.value = true
  erroVinculo.value = null
  try {
    const criado = await api.vinculos.criar(leiId, {
      id_lei_origem: novoVinculo.id_lei_origem,
      tipo_vinculo: novoVinculo.tipo_vinculo,
      trechos: novoVinculo.trechos.map((t, i) => ({
        referencia: t.referencia,
        texto_original: t.texto_original || null,
        texto_novo: t.texto_novo || null,
        tipo: t.tipo,
        ordem: i + 1,
      })),
    })
    vinculos.value.push(criado)
    modalVinculo.value = false
  } catch (e) {
    erroVinculo.value = e.message
  } finally {
    salvandoVinculo.value = false
  }
}

async function removerVinculo(vinculo) {
  if (!confirm('Remover este vínculo?')) return
  try {
    await api.vinculos.remover(leiId, vinculo.id_lei_vinculo)
    vinculos.value = vinculos.value.filter(v => v.id_lei_vinculo !== vinculo.id_lei_vinculo)
  } catch (e) {
    alert(e.message)
  }
}

async function carregarVersoes() {
  if (versoesCarregadas.value) return
  carregandoVersoes.value = true
  try {
    const data = await api.leis.versoes(leiId)
    versoes.value = Array.isArray(data) ? data : (data?.data ?? [])
    versoesCarregadas.value = true
  } catch {}
  carregandoVersoes.value = false
}

// ─── anexos ────────────────────────────────────────────────────────────────
async function fazerUploadAnexo(event) {
  const file = event.target.files[0]
  if (!file || !versao.value) return
  uploadandoAnexo.value = true
  try {
    const fd = new FormData()
    fd.append('arquivo', file)
    fd.append('tipo_arquivo', file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'imagem' : 'outro')
    const anexo = await api.anexos.upload(versao.value.id_versao_lei, fd)
    if (!versao.value.anexos) versao.value.anexos = []
    versao.value.anexos.push(anexo)
  } catch (e) {
    alert('Erro no upload: ' + e.message)
  } finally {
    uploadandoAnexo.value = false
    event.target.value = ''
  }
}

async function removerAnexo(anexo) {
  if (!confirm('Remover este anexo?')) return
  try {
    await api.anexos.remover(versao.value.id_versao_lei, anexo.id_anexo_lei)
    versao.value.anexos = versao.value.anexos.filter(a => a.id_anexo_lei !== anexo.id_anexo_lei)
  } catch (e) {
    alert(e.message)
  }
}

function formatarBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const tiposVinculo = [
  { value: 'altera', label: 'Altera' },
  { value: 'complementa', label: 'Complementa' },
  { value: 'revoga', label: 'Revoga' },
  { value: 'acrescenta', label: 'Acrescenta' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <header class="bg-green-900 text-white shadow">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
        </svg>
        <h1 class="text-lg font-semibold tracking-wide">Assembleia Legislativa — Ceará</h1>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center pt-24">
      <svg class="w-8 h-8 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    </div>

    <main v-else class="max-w-5xl mx-auto px-6 py-6">
      <!-- Breadcrumb -->
      <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">
        <span class="hover:underline cursor-pointer" @click="cancelar">Atos normativos</span>
        <span class="mx-1">/</span>
        <span class="text-gray-600 font-medium">Edição</span>
      </p>

      <!-- Título + ações -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">
            Editar: Lei nº {{ lei?.numero }}/{{ lei?.ano }}
          </h2>
          <p v-if="lei?.versao_atual?.data_publicacao" class="text-sm text-gray-500 mt-0.5">
            Processo legislativo iniciado em {{ new Date(lei.versao_atual.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) }}
          </p>
        </div>
        <div class="flex gap-3 items-center">
          <button @click="cancelar" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">
            Cancelar
          </button>
          <a href="#" class="flex items-center gap-1.5 text-sm text-green-800 font-medium hover:underline">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            Visualizar como Cidadão
          </a>
        </div>
      </div>

      <div v-if="erroGeral" class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {{ erroGeral }}
      </div>

      <!-- Layout em 2 colunas -->
      <div class="flex gap-5 items-start">
        <!-- Coluna principal -->
        <div class="flex-1 min-w-0 space-y-5">

          <!-- Conteúdo da Lei -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3 class="font-semibold text-gray-800">Conteúdo da Lei</h3>
              </div>
              <div class="flex gap-2">
                <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">Comparativo</button>
                <button class="px-3 py-1 text-xs font-medium bg-green-800 text-white rounded-lg hover:bg-green-700 transition">Focado</button>
              </div>
            </div>

            <div class="mb-4">
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Texto Integral da Lei</label>
              <div class="rounded-lg border border-gray-200 overflow-hidden">
                <div class="flex gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <button type="button" @mousedown.prevent="document.execCommand('bold')" class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs font-bold">B</button>
                  <button type="button" @mousedown.prevent="document.execCommand('italic')" class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs italic">I</button>
                  <button type="button" @mousedown.prevent="document.execCommand('underline')" class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs underline">U</button>
                  <button type="button" @mousedown.prevent="document.execCommand('strikeThrough')" class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs line-through">S</button>
                  <div class="w-px bg-gray-200 mx-1"></div>
                  <button type="button" @mousedown.prevent="document.execCommand('removeFormat')" class="p-1 rounded text-gray-400 hover:bg-gray-200 text-xs" title="Remover formatação">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div
                  ref="editorIntegral"
                  contenteditable="true"
                  @input="formVersao.texto_integral = $event.target.innerHTML"
                  class="min-h-[280px] max-h-[480px] overflow-y-auto p-4 text-sm text-gray-700 focus:outline-none leading-relaxed"
                  style="word-break: break-word;"
                ></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Texto da Lei Alterada</label>
                <div class="rounded-lg border border-gray-200 p-3 bg-gray-50 min-h-[180px]">
                  <div class="flex gap-1 mb-2">
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs font-bold">B</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs italic">I</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs line-through">S</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h8"/></svg></button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/></svg></button>
                  </div>
                  <textarea v-model="formVersao.texto_alterado" rows="6" placeholder="Trecho original da lei que foi alterado..."
                    class="w-full text-sm bg-transparent resize-none focus:outline-none text-gray-700"></textarea>
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Texto Consolidado</label>
                <div class="rounded-lg border border-gray-200 p-3 min-h-[180px]">
                  <div class="flex gap-1 mb-2">
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs font-bold">B</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs italic">I</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200 text-xs line-through">S</button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h8"/></svg></button>
                    <button class="p-1 rounded text-gray-500 hover:bg-gray-200"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/></svg></button>
                  </div>
                  <textarea v-model="formVersao.texto_consolidado" rows="6" placeholder="Texto com as alterações aplicadas..."
                    class="w-full text-sm resize-none focus:outline-none text-gray-700"></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Dados Básicos -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <h3 class="font-semibold text-gray-800">Dados Básicos</h3>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número</label>
                <input v-model="formLei.numero" type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ano</label>
                <input v-model.number="formLei.ano" type="number"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Ato</label>
                <select v-model.number="formLei.id_tipo_lei"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
                  <option value="">Selecione...</option>
                  <option v-for="t in tiposLei" :key="t.id_tipo_lei" :value="t.id_tipo_lei">{{ t.nome }}</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Autor</label>
                <input v-model="formLei.autor" type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data DOE</label>
                <input v-model="formLei.data_doe" type="date"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data de Publicação</label>
                <input v-model="formVersao.data_publicacao" type="date"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas de Revisão</label>
                <input v-model="formVersao.notas_revisao" type="text" placeholder="Ex: Alterada pela LC 147/2014"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
            </div>

            <!-- Temas -->
            <div class="mb-4">
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Temas Relacionados</label>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="id in formLei.temas"
                  :key="id"
                  class="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 border border-green-200 rounded-full px-3 py-1"
                >
                  {{ temaNome(id) }}
                  <button type="button" @click="toggleTema(id)" class="hover:text-green-900">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
                <div class="relative">
                  <select @change="e => { toggleTema(Number(e.target.value)); e.target.value = '' }"
                    class="text-xs border border-dashed border-gray-300 rounded-full px-3 py-1 bg-white text-gray-500 focus:outline-none focus:border-green-500 cursor-pointer">
                    <option value="">+ Adicionar Tema</option>
                    <option v-for="t in temas.filter(t => !formLei.temas.includes(t.id_tema))" :key="t.id_tema" :value="t.id_tema">{{ t.nome }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Ementa -->
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ementa</label>
              <textarea v-model="formVersao.ementa" rows="3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"></textarea>
            </div>
          </div>

          <!-- Leis Vinculadas -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-green-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0l4-4m-4 4L6.343 6.343"/>
                </svg>
                <h3 class="font-semibold text-gray-800">Leis vinculadas</h3>
              </div>
              <button @click="abrirModalVinculo"
                class="flex items-center gap-1.5 text-xs font-medium text-green-800 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Vincular lei
              </button>
            </div>

            <div v-if="vinculos.length === 0" class="text-center py-8">
              <svg class="w-8 h-8 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0l4-4m-4 4L6.343 6.343"/>
              </svg>
              <p class="text-sm text-gray-400">Nenhuma lei vinculada.</p>
              <button @click="abrirModalVinculo" class="mt-2 text-sm text-green-700 hover:underline">Vincular primeira lei</button>
            </div>

            <div v-else class="grid grid-cols-2 gap-3">
              <div
                v-for="v in vinculos"
                :key="v.id_lei_vinculo"
                class="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div class="w-8 h-8 rounded bg-red-100 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">
                    Lei nº {{ v.lei_origem?.numero }}/{{ v.lei_origem?.ano }}
                  </p>
                  <p class="text-xs text-gray-400">
                    Vinculado em {{ formatarDataHora(v.criado_em) }}
                    · <span class="capitalize">{{ v.tipo_vinculo }}</span>
                  </p>
                </div>
                <button @click="removerVinculo(v)" class="p-1 text-gray-300 hover:text-red-500 transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>

              <!-- Placeholder upload -->
              <div class="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg p-4 text-gray-400 cursor-pointer hover:border-gray-400 transition" @click="abrirModalVinculo">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <span class="text-xs">UPLOAD DE PDF</span>
              </div>
            </div>
          </div>

          <!-- Anexos -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-4 h-4 text-green-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              <h3 class="font-semibold text-gray-800">Anexos</h3>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- Anexos existentes -->
              <div
                v-for="anexo in (versao?.anexos ?? [])"
                :key="anexo.id_anexo_lei"
                class="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div class="w-8 h-8 rounded bg-red-100 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ anexo.nome_original }}</p>
                  <p class="text-xs text-gray-400">
                    {{ formatarBytes(anexo.tamanho_bytes) }}
                    <span v-if="anexo.criado_em"> · Enviado em {{ new Date(anexo.criado_em).toLocaleDateString('pt-BR') }}</span>
                  </p>
                </div>
                <button @click="removerAnexo(anexo)" class="p-1 text-gray-300 hover:text-red-500 transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>

              <!-- Botão de upload -->
              <label class="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg p-4 text-gray-400 cursor-pointer hover:border-gray-400 transition">
                <input type="file" ref="inputAnexo" class="hidden" accept=".pdf,.doc,.docx,image/*" @change="fazerUploadAnexo" />
                <svg v-if="!uploadandoAnexo" class="w-6 h-6 mb-1" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <svg v-else class="w-6 h-6 mb-1 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span class="text-xs">UPLOAD DE PDF</span>
              </label>
            </div>
          </div>

        </div>

        <!-- Coluna lateral -->
        <div class="w-64 shrink-0 space-y-4">

          <!-- Histórico -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h4 class="text-sm font-semibold text-gray-800">HISTÓRICO</h4>
            </div>
            <div class="space-y-3">
              <div v-if="versao" class="flex gap-2.5">
                <div class="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                <div>
                  <p class="text-sm font-medium text-gray-800">Revisão {{ versao.numero_versao }}</p>
                  <p class="text-xs text-gray-400">{{ formatarDataHora(versao.criado_em) }}</p>
                  <p v-if="versao.notas_revisao" class="text-xs text-gray-600 mt-0.5 italic">{{ versao.notas_revisao }}</p>
                </div>
              </div>
              <div class="flex gap-2.5">
                <div class="mt-1.5 w-2 h-2 rounded-full bg-gray-300 shrink-0"></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">Texto original</p>
                  <p class="text-xs text-gray-400">{{ lei?.criado_em ? formatarDataHora(lei.criado_em) : '' }}</p>
                </div>
              </div>
            </div>
            <button @click="carregarVersoes" class="mt-3 flex items-center gap-1 text-xs text-green-700 hover:underline font-medium">
              <svg v-if="carregandoVersoes" class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              VER HISTÓRICO COMPLETO
            </button>

            <!-- Lista de versões -->
            <div v-if="versoes.length > 0" class="mt-3 border-t border-gray-100 pt-3 space-y-2.5">
              <div v-for="v in versoes.slice().reverse()" :key="v.id_versao_lei" class="flex gap-2.5">
                <div :class="v.versao_atual ? 'bg-green-500' : 'bg-gray-300'" class="mt-1.5 w-2 h-2 rounded-full shrink-0"></div>
                <div class="min-w-0">
                  <p class="text-xs font-medium text-gray-700">
                    Versão {{ v.numero_versao }}
                    <span :class="{
                      'text-green-600': v.status === 'publicado',
                      'text-yellow-600': v.status === 'revisao',
                      'text-gray-400': v.status === 'pendente',
                    }" class="capitalize font-normal"> · {{ v.status }}</span>
                  </p>
                  <p class="text-xs text-gray-400">{{ formatarDataHora(v.criado_em) }}</p>
                  <p v-if="v.notas_revisao" class="text-xs text-gray-500 italic truncate">{{ v.notas_revisao }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Notas do curador -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
              </svg>
              <h4 class="text-sm font-semibold text-gray-800">NOTAS DO CURADOR</h4>
            </div>
            <textarea v-model="formVersao.notas_curador" rows="4" placeholder="Adicione uma observação interna..."
              class="w-full text-sm text-gray-700 bg-transparent resize-none focus:outline-none placeholder-gray-300"></textarea>
            <p class="text-xs text-gray-300 mt-1">Visível apenas para a equipe administrativa</p>
          </div>

        </div>
      </div>

      <!-- Rodapé fixo com status -->
      <div class="bg-green-900 rounded-xl mt-5 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div>
            <p class="text-xs text-green-400 uppercase tracking-wide mb-0.5">Status atual</p>
            <span class="text-xs font-semibold text-white uppercase">{{ formVersao.status }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <p v-if="ultimaSalvagem" class="text-xs text-green-400">
            Última alteração salva {{ tempoAtras(ultimaSalvagem) }}
          </p>
          <button
            @click="publicar"
            :disabled="salvando"
            class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-white text-green-900 rounded-lg hover:bg-green-50 disabled:opacity-50 transition"
          >
            <svg v-if="salvando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
            Publicar Ato
          </button>
          <button
            @click="salvarRascunho"
            :disabled="salvando"
            class="px-5 py-2.5 text-sm font-semibold border border-green-600 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 transition"
          >
            Salvar Rascunho
          </button>
        </div>
      </div>
    </main>

    <!-- Modal: Vincular Lei -->
    <teleport to="body">
      <div v-if="modalVinculo" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 class="font-semibold text-gray-800">Vincular lei alteradora</h3>
            <button @click="modalVinculo = false" class="text-gray-400 hover:text-gray-700">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="px-5 py-4 space-y-4">
            <div v-if="erroVinculo" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
              {{ erroVinculo }}
            </div>

            <!-- Busca de lei -->
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lei de Origem</label>
              <div class="relative">
                <input
                  v-model="buscaLei"
                  @input="buscarLeis"
                  type="text"
                  placeholder="Buscar por ementa, número ou ano..."
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <div v-if="buscandoLei" class="absolute right-3 top-2.5">
                  <svg class="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
                <!-- Dropdown resultados -->
                <ul v-if="buscaResultados.length > 0" class="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  <li
                    v-for="r in buscaResultados"
                    :key="r.id_lei"
                    @click="selecionarLeiOrigem(r)"
                    class="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <span class="font-medium">Lei nº {{ r.numero }}/{{ r.ano }}</span>
                    <span class="text-gray-400 text-xs ml-2">{{ r.versao_atual?.ementa?.slice(0, 60) }}...</span>
                  </li>
                </ul>
              </div>
              <p v-if="novoVinculo.id_lei_origem" class="mt-1 text-xs text-green-700 font-medium">
                ✓ {{ novoVinculo.leiOrigemLabel }} selecionada
              </p>
            </div>

            <!-- Tipo de vínculo -->
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Vínculo</label>
              <select v-model="novoVinculo.tipo_vinculo"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
                <option v-for="t in tiposVinculo" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>

            <!-- Trechos -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trechos de Alteração</label>
                <button @click="adicionarTrecho" type="button"
                  class="text-xs text-green-700 hover:underline font-medium">+ Adicionar trecho</button>
              </div>
              <div v-if="novoVinculo.trechos.length === 0" class="text-xs text-gray-400 italic">
                Nenhum trecho adicionado. Clique em "+ Adicionar trecho".
              </div>
              <div
                v-for="(trecho, idx) in novoVinculo.trechos"
                :key="idx"
                class="border border-gray-200 rounded-lg p-3 mb-2 space-y-2 bg-gray-50"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-gray-500">Trecho {{ idx + 1 }}</span>
                  <button @click="removerTrecho(idx)" class="text-xs text-red-400 hover:text-red-600">Remover</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-gray-400 mb-0.5">Referência</label>
                    <input v-model="trecho.referencia" type="text" placeholder="Art. 3º"
                      class="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-400 mb-0.5">Tipo</label>
                    <select v-model="trecho.tipo"
                      class="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none bg-white focus:ring-1 focus:ring-green-500">
                      <option value="substituicao">Substituição</option>
                      <option value="acrescimo">Acréscimo</option>
                      <option value="revogacao">Revogação</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-0.5">Texto original</label>
                  <textarea v-model="trecho.texto_original" rows="2" placeholder="Redação anterior..."
                    class="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"></textarea>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-0.5">Texto novo</label>
                  <textarea v-model="trecho.texto_novo" rows="2" placeholder="Nova redação..."
                    class="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 px-5 py-4 border-t border-gray-200">
            <button @click="modalVinculo = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancelar
            </button>
            <button
              @click="salvarVinculo"
              :disabled="salvandoVinculo"
              class="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-green-800 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              <svg v-if="salvandoVinculo" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Salvar vínculo
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
