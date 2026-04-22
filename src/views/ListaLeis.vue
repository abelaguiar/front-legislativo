<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'

import EditorTexto from '../components/EditorTexto.vue'
import AppHeader from '../components/AppHeader.vue'

const router = useRouter()

const leis = ref([])
const meta = ref(null)
const loading = ref(false)
const erro = ref(null)
const pagina = ref(1)
const filtros = reactive({ numero: '', ementa: '', data_inicio: '', data_fim: '' })
let filtroTimer = null

async function carregar() {
  loading.value = true
  erro.value = null
  try {
    const params = { page: pagina.value }
    if (filtros.numero)      params['filter[numero]']      = filtros.numero
    if (filtros.ementa)      params['filter[ementa]']      = filtros.ementa
    if (filtros.data_inicio) params['filter[data_inicio]'] = filtros.data_inicio
    if (filtros.data_fim)    params['filter[data_fim]']    = filtros.data_fim
    const data = await api.leis.listar(params)
    leis.value = data.data
    meta.value = data.meta ?? null
    // Carrega contagem de vínculos em paralelo (o endpoint de listagem não retorna vinculos_count)
    carregarContagemVinculos(leis.value)
  } catch (e) {
    erro.value = e.message
  } finally {
    loading.value = false
  }
}

async function carregarContagemVinculos(lista) {
  await Promise.allSettled(
    lista.map(async (lei) => {
      try {
        const v = await api.vinculos.listar(lei.id_lei)
        lei.vinculos_lista = Array.isArray(v) ? v : []
        lei.vinculos_count = lei.vinculos_lista.length
      } catch {
        lei.vinculos_lista = []
        lei.vinculos_count = 0
      }
    })
  )
  // Força reatividade: substitui o array para o Vue detectar as mutações
  leis.value = [...leis.value]
}

watch(filtros, () => {
  filtroTimer = setTimeout(() => { pagina.value = 1; carregar() }, 400)
})
watch(pagina, carregar)
onMounted(carregar)

function irParaLei(id) {
  router.push({ name: 'detalhe-lei', params: { id } })
}

function editarLei(id) {
  router.push({ name: 'edicao-lei', params: { id } })
}

function novoCadastro() {
  router.push({ name: 'cadastro-lei' })
}

// ─── Modal vincular ────────────────────────────────────────────────────────
const modalVinculo = ref(false)
const leiAlvoId = ref(null)
const leiAlvoLabel = ref('')
const buscaLei = ref('')
const buscaResultados = ref([])
const buscandoLei = ref(false)
const erroVinculo = ref(null)
const salvandoVinculo = ref(false)
const leiOrigemData = ref(null)
const carregandoLeiOrigem = ref(false)
const trechoAtivo = ref(null) // índice do trecho sendo editado
const novoVinculo = reactive({
  id_lei_origem: null,
  leiOrigemLabel: '',
  tipo_vinculo: 'altera',
  trechos: [],
})

const tiposVinculo = [
  { value: 'altera', label: 'Altera' },
  { value: 'complementa', label: 'Complementa' },
  { value: 'revoga', label: 'Revoga' },
  { value: 'acrescenta', label: 'Acrescenta' },
]

const tipoVinculoConfig = {
  altera:      { label: 'Altera',      cor: 'bg-blue-100 text-blue-800 border-blue-200' },
  revoga:      { label: 'Revoga',      cor: 'bg-red-100 text-red-800 border-red-200' },
  complementa: { label: 'Complementa', cor: 'bg-purple-100 text-purple-800 border-purple-200' },
  acrescenta:  { label: 'Acrescenta',  cor: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
}

// Extrai blocos de artigos do texto_integral (HTML ou texto puro)
const artigosOrigemParsed = computed(() => {
  const texto = leiOrigemData.value?.versao_atual?.texto_integral ?? ''
  if (!texto) return []
  // Remove tags HTML para análise
  const plain = texto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const regex = /(Art\.?\s*\d+[ºo°]?[^A-Z]*?(?:Art\.?\s*\d+[ºo°]?|$))/g
  const partes = plain.split(/(Art\.?\s*\d+[ºo°]?)/i).filter(Boolean)
  const artigos = []
  for (let i = 0; i < partes.length; i++) {
    if (/^Art\.?\s*\d+/i.test(partes[i])) {
      const ref = partes[i].trim()
      const corpo = (partes[i + 1] ?? '').trim()
      artigos.push({ referencia: ref, texto: corpo.slice(0, 400) + (corpo.length > 400 ? '...' : '') })
      i++
    }
  }
  return artigos
})

function abrirModalVinculo(lei) {
  leiAlvoId.value = lei.id_lei
  leiAlvoLabel.value = `Lei nº ${lei.numero}/${lei.ano}`
  Object.assign(novoVinculo, { id_lei_origem: null, leiOrigemLabel: '', tipo_vinculo: 'altera', trechos: [] })
  buscaLei.value = ''
  buscaResultados.value = []
  erroVinculo.value = null
  leiOrigemData.value = null
  trechoAtivo.value = null
  modalVinculo.value = true
}

let buscaTimer = null
function buscarLeis() {
  clearTimeout(buscaTimer)
  if (!buscaLei.value.trim()) { buscaResultados.value = []; return }
  buscaTimer = setTimeout(async () => {
    buscandoLei.value = true
    try {
      const res = await api.leis.listar({ 'filter[busca]': buscaLei.value.trim(), per_page: 10 })
      buscaResultados.value = (res.data ?? []).filter(l => l.id_lei !== leiAlvoId.value)
    } catch {}
    buscandoLei.value = false
  }, 400)
}

async function selecionarLeiOrigem(l) {
  novoVinculo.id_lei_origem = l.id_lei
  novoVinculo.leiOrigemLabel = `Lei nº ${l.numero}/${l.ano}`
  buscaLei.value = novoVinculo.leiOrigemLabel
  buscaResultados.value = []
  carregandoLeiOrigem.value = true
  try {
    leiOrigemData.value = await api.leis.mostrar(l.id_lei)
  } catch {}
  carregandoLeiOrigem.value = false
}

function preencherTrechoComArtigo(artigo) {
  // Se não há trecho ativo, adiciona um novo
  if (trechoAtivo.value === null || trechoAtivo.value >= novoVinculo.trechos.length) {
    adicionarTrecho()
    trechoAtivo.value = novoVinculo.trechos.length - 1
  }
  const trecho = novoVinculo.trechos[trechoAtivo.value]
  trecho.referencia = artigo.referencia
  trecho.texto_original = artigo.texto
}

function adicionarTrecho() {
  novoVinculo.trechos.push({ referencia: '', texto_original: '', texto_novo: '', tipo: 'substituicao', ordem: novoVinculo.trechos.length + 1 })
}

function removerTrecho(idx) {
  novoVinculo.trechos.splice(idx, 1)
  novoVinculo.trechos.forEach((t, i) => { t.ordem = i + 1 })
}

async function salvarVinculo() {
  if (!novoVinculo.id_lei_origem) { erroVinculo.value = 'Selecione a lei de origem.'; return }
  salvandoVinculo.value = true
  erroVinculo.value = null
  try {
    await api.vinculos.criar(leiAlvoId.value, {
      id_lei_origem: novoVinculo.id_lei_origem,
      tipo_vinculo: novoVinculo.tipo_vinculo,
      trechos: novoVinculo.trechos,
    })
    modalVinculo.value = false
  } catch (e) {
    erroVinculo.value = e.message
  } finally {
    salvandoVinculo.value = false
  }
}

function formatarDataHora(valor) {
  if (!valor) return '—'
  const d = new Date(valor)
  if (isNaN(d)) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy}\n${hh}:${min}`
}

function statusConfig(status) {
  switch ((status ?? '').toLowerCase()) {
    case 'publicado':
      return { label: 'Publicado', dot: true, cls: 'bg-green-100 text-green-800 border border-green-200' }
    case 'revisao':
    case 'revisão':
      return { label: 'Revisão', warning: true, cls: 'bg-amber-100 text-amber-800 border border-amber-200' }
    case 'rascunho':
      return { label: 'Rascunho', doc: true, cls: 'bg-gray-100 text-gray-500 border border-gray-200' }
    case 'pendente':
      return { label: 'Pendente', doc: true, cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' }
    default:
      return { label: status ?? '—', cls: 'bg-gray-100 text-gray-500 border border-gray-200' }
  }
}

const paginas = computed(() => {
  if (!meta.value) return []
  const total = parseInt(Array.isArray(meta.value.last_page) ? meta.value.last_page[0] : meta.value.last_page) || 0
  const atual = pagina.value
  if (!total) return []
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (atual <= 3) return [1, 2, 3, '...', total]
  if (atual >= total - 2) return [1, '...', total - 2, total - 1, total]
  return [1, '...', atual - 1, atual, atual + 1, '...', total]
})

function safeInt(v) {
  if (Array.isArray(v)) return Number(v[0]) || 0
  return Number(v) || 0
}

const from  = computed(() => safeInt(meta.value?.from))
const to    = computed(() => safeInt(meta.value?.to))
const total = computed(() => safeInt(meta.value?.total))
const lastPage = computed(() => safeInt(meta.value?.last_page))
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <AppHeader />

    <main class="max-w-6xl mx-auto px-6 py-6">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">

        <!-- Tabs -->
        <div class="flex border-b border-gray-200">
          <button class="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-green-800 border-b-2 border-green-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Histórico
          </button>
          <button @click="novoCadastro" class="flex items-center gap-2 px-5 py-3.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Novo cadastro
          </button>
          <button class="flex items-center gap-2 px-5 py-3.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
            </svg>
            Autores
          </button>
          <button class="flex items-center gap-2 px-5 py-3.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            Campos temáticos
          </button>
        </div>

        <!-- Filtros -->
        <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número</label>
              <input v-model="filtros.numero" type="text" placeholder="Ex: 1234"
                class="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div class="flex-1 min-w-[12rem]">
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ementa</label>
              <input v-model="filtros.ementa" type="text" placeholder="Buscar por ementa..."
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data início</label>
              <input v-model="filtros.data_inicio" type="date"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data fim</label>
              <input v-model="filtros.data_fim" type="date"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <button
              v-if="filtros.numero || filtros.ementa || filtros.data_inicio || filtros.data_fim"
              @click="Object.assign(filtros, { numero: '', ementa: '', data_inicio: '', data_fim: '' })"
              class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-3 py-2 transition self-end"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpar filtros
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-16">
          <svg class="w-8 h-8 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>

        <!-- Erro -->
        <div v-else-if="erro" class="px-6 py-4 text-sm text-red-700 bg-red-50">
          {{ erro }}
        </div>

        <!-- Vazio -->
        <div v-else-if="leis.length === 0" class="text-center py-16 text-gray-400 text-sm">
          Nenhuma lei encontrada.
        </div>

        <template v-else>
          <!-- Cabeçalho da tabela -->
          <div class="grid grid-cols-[130px_1fr_110px_140px_130px_80px] px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide select-none">
            <div class="flex items-center gap-1">
              N° / ANO
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </div>
            <div class="flex items-center gap-1">
              TIPO E EMENTA
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </div>
            <div class="flex items-center gap-1">
              MODIFICADO EM
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </div>
            <div>VÍNCULOS</div>
            <div>STATUS</div>
            <div>AÇÕES</div>
          </div>

          <!-- Linhas -->
          <div
            v-for="lei in leis"
            :key="lei.id_lei"
            class="grid grid-cols-[130px_1fr_110px_140px_130px_80px] px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
          >
            <!-- N° / ANO -->
            <div>
              <p class="text-2xl font-bold text-gray-800 leading-tight">{{ lei.numero?.toLocaleString('pt-BR') }}</p>
              <p class="text-sm text-gray-400">/ {{ lei.ano }}</p>
            </div>

            <!-- TIPO E EMENTA -->
            <div class="pr-6">
              <span class="inline-block text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 rounded px-2 py-0.5 mb-1.5">
                {{ lei.tipo_lei?.nome ?? lei.tipo_lei?.sigla ?? 'Lei' }}
              </span>
              <p class="text-sm text-gray-600 line-clamp-2 leading-snug">
                {{ lei.versao_atual?.ementa ?? '—' }}
              </p>
            </div>

            <!-- MODIFICADO EM -->
            <div class="text-sm text-gray-500 whitespace-pre-line">{{ formatarDataHora(lei.updated_at ?? lei.versao_atual?.data_publicacao) }}</div>

            <!-- VÍNCULOS -->
            <div class="flex flex-col gap-1 pt-0.5">
              <template v-if="(lei.vinculos_count ?? 0) > 0">
                <div
                  v-for="v in lei.vinculos_lista"
                  :key="v.id_vinculo ?? v.id_lei_vinculo ?? v.id"
                  class="flex flex-col gap-0.5"
                >
                  <span :class="['inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-tight w-fit', (tipoVinculoConfig[v.tipo_vinculo]?.cor ?? 'bg-gray-100 text-gray-700 border-gray-200')]">
                    {{ tipoVinculoConfig[v.tipo_vinculo]?.label ?? v.tipo_vinculo }}
                  </span>
                  <span class="text-xs text-gray-600 leading-tight">
                    Lei nº {{ v.lei_origem?.numero }}/{{ v.lei_origem?.ano }}
                  </span>
                </div>
              </template>
              <span v-else class="text-xs text-gray-300">—</span>
            </div>

            <!-- STATUS -->
            <div>
              <span
                :class="statusConfig(lei.versao_atual?.status).cls"
                class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1"
              >
                <span v-if="statusConfig(lei.versao_atual?.status).dot" class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                <svg v-else-if="statusConfig(lei.versao_atual?.status).warning" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <svg v-else-if="statusConfig(lei.versao_atual?.status).doc" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                {{ statusConfig(lei.versao_atual?.status).label }}
              </span>
            </div>

            <!-- AÇÕES -->
            <div class="flex items-center gap-1">
              <button
                @click="irParaLei(lei.id_lei)"
                class="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                title="Visualizar"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button
                @click="editarLei(lei.id_lei)"
                class="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                title="Editar"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                @click="abrirModalVinculo(lei)"
                class="p-1.5 rounded-md text-gray-400 hover:text-green-700 hover:bg-green-50 transition"
                title="Vincular lei"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0l4-4m-4 4L6.343 6.343"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Paginação -->
          <div class="flex items-center justify-between gap-4 px-5 py-3 border-t border-gray-100 bg-white">
            <!-- Resumo -->
            <p class="text-sm text-gray-500 whitespace-nowrap shrink-0">
              <span class="font-medium text-gray-800">{{ from }}–{{ to }}</span>
              de <span class="font-medium text-gray-800">{{ total.toLocaleString('pt-BR') }}</span>
            </p>

            <!-- Controles -->
            <div class="flex items-center gap-0.5 overflow-x-auto">
              <!-- Anterior -->
              <button
                :disabled="pagina <= 1"
                @click="pagina--"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 transition"
                title="Página anterior"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>

              <!-- Números -->
              <template v-for="(p, idx) in paginas" :key="idx">
                <span
                  v-if="p === '...'"
                  class="shrink-0 w-7 h-8 flex items-center justify-center text-sm text-gray-300 select-none"
                >…</span>
                <button
                  v-else
                  @click="pagina = p"
                  :class="pagina === p
                    ? 'bg-green-700 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'"
                  class="shrink-0 min-w-[2rem] h-8 px-1 flex items-center justify-center rounded-md text-sm transition"
                >
                  {{ p }}
                </button>
              </template>

              <!-- Próxima -->
              <button
                :disabled="pagina >= lastPage"
                @click="pagina++"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 transition"
                title="Próxima página"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>

              <!-- Ir para página -->
              <template v-if="lastPage > 7">
                <div class="shrink-0 w-px h-5 bg-gray-200 mx-1"></div>
                <input
                  type="number"
                  :placeholder="String(pagina)"
                  :min="1"
                  :max="lastPage"
                  @keydown.enter="(e) => {
                    const v = parseInt(e.target.value)
                    if (v >= 1 && v <= lastPage) pagina = v
                    e.target.value = ''
                  }"
                  class="shrink-0 w-14 h-8 rounded-md border border-gray-200 text-center text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600"
                  title="Ir para página (Enter)"
                  style="-moz-appearance:textfield"
                />
              </template>
            </div>
          </div>
        </template>

      </div>
    </main>
  </div>

  <!-- Modal: Vincular Lei -->
  <teleport to="body">
    <div v-if="modalVinculo" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col" style="height: 90vh;">

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 class="font-semibold text-gray-900 text-base">Vincular lei alteradora</h3>
            <p class="text-xs text-gray-400 mt-0.5">Lei alvo: <span class="font-medium text-gray-600">{{ leiAlvoLabel }}</span></p>
          </div>
          <button @click="modalVinculo = false" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Busca + Tipo (faixa superior) -->
        <div class="px-6 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
          <div class="flex gap-4 items-end">
            <div class="flex-1">
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
                <ul v-if="buscaResultados.length > 0" class="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                  <li
                    v-for="r in buscaResultados"
                    :key="r.id_lei"
                    @click="selecionarLeiOrigem(r)"
                    class="px-3 py-2.5 text-sm text-gray-700 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <span class="font-medium text-gray-900">Lei nº {{ r.numero }}/{{ r.ano }}</span>
                    <span v-if="r.tipo_lei" class="ml-2 text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ r.tipo_lei.sigla }}</span>
                    <p class="text-xs text-gray-400 mt-0.5 truncate">{{ r.versao_atual?.ementa ?? '' }}</p>
                  </li>
                </ul>
              </div>
            </div>
            <div class="w-48">
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Vínculo</label>
              <select v-model="novoVinculo.tipo_vinculo"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
                <option v-for="t in tiposVinculo" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
          </div>
          <div v-if="erroVinculo" class="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {{ erroVinculo }}
          </div>
        </div>

        <!-- Corpo em 2 colunas -->
        <div class="flex flex-1 min-h-0">

          <!-- Coluna esquerda: texto original da lei origem -->
          <div class="w-2/5 border-r border-gray-200 flex flex-col">
            <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Texto da Lei de Origem</span>
              <span v-if="leiOrigemData" class="text-xs text-gray-400">Clique num artigo para preencher o trecho</span>
            </div>

            <!-- Carregando -->
            <div v-if="carregandoLeiOrigem" class="flex-1 flex items-center justify-center">
              <svg class="w-6 h-6 animate-spin text-green-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>

            <!-- Sem lei selecionada -->
            <div v-else-if="!leiOrigemData" class="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2 px-6 text-center">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p class="text-sm">Selecione uma lei de origem para visualizar seu conteúdo</p>
            </div>

            <!-- Artigos parseados -->
            <div v-else-if="artigosOrigemParsed.length > 0" class="flex-1 overflow-y-auto">
              <!-- Ementa -->
              <div class="px-4 py-3 bg-green-50 border-b border-green-100">
                <p class="text-xs font-semibold text-green-800 mb-0.5">{{ leiOrigemData.versao_atual?.ementa }}</p>
              </div>
              <!-- Lista de artigos -->
              <div
                v-for="(artigo, idx) in artigosOrigemParsed"
                :key="idx"
                @click="preencherTrechoComArtigo(artigo)"
                class="px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-green-50 group transition"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-gray-800 group-hover:text-green-800">{{ artigo.referencia }}</p>
                    <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">{{ artigo.texto }}</p>
                  </div>
                  <svg class="w-3.5 h-3.5 text-gray-200 group-hover:text-green-500 shrink-0 mt-0.5 transition" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Texto integral sem artigos detectados -->
            <div v-else class="flex-1 overflow-y-auto px-4 py-3">
              <p class="text-xs text-gray-400 italic mb-2">Nenhum artigo detectado. Texto integral:</p>
              <p class="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{{ (leiOrigemData.versao_atual?.texto_integral ?? '').replace(/<[^>]+>/g, ' ') }}</p>
            </div>
          </div>

          <!-- Coluna direita: trechos -->
          <div class="flex-1 flex flex-col min-w-0">
            <div class="px-5 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trechos de Alteração</span>
              <button
                @click="adicionarTrecho(); trechoAtivo = novoVinculo.trechos.length - 1"
                type="button"
                class="flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-900 transition"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Adicionar trecho
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4">
              <div v-if="novoVinculo.trechos.length === 0" class="flex flex-col items-center justify-center h-full text-gray-300 gap-2 text-center">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <p class="text-sm">Clique em um artigo ao lado ou em<br>"Adicionar trecho" para começar</p>
              </div>

              <div
                v-for="(trecho, idx) in novoVinculo.trechos"
                :key="idx"
                :class="trechoAtivo === idx ? 'border-green-400 ring-1 ring-green-300' : 'border-gray-200'"
                class="border rounded-xl mb-3 overflow-hidden transition"
                @click="trechoAtivo = idx"
              >
                <!-- Cabeçalho do trecho -->
                <div :class="trechoAtivo === idx ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'" class="flex items-center justify-between px-4 py-2.5 border-b">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold shrink-0">{{ idx + 1 }}</span>
                    <span class="text-xs font-semibold text-gray-600">{{ trecho.referencia || 'Sem referência' }}</span>
                    <span class="text-xs bg-white border border-gray-200 text-gray-500 rounded px-1.5 py-0.5 capitalize">{{ trecho.tipo }}</span>
                  </div>
                  <button @click.stop="removerTrecho(idx)" class="text-xs text-red-400 hover:text-red-600 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>

                <!-- Campos do trecho -->
                <div class="p-4 space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-gray-400 font-medium mb-1">Referência</label>
                      <input v-model="trecho.referencia" type="text" placeholder="Art. 3º, § 1º…"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-400 font-medium mb-1">Tipo de alteração</label>
                      <select v-model="trecho.tipo"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none bg-white focus:ring-2 focus:ring-green-500">
                        <option value="substituicao">Substituição</option>
                        <option value="acrescimo">Acréscimo</option>
                        <option value="revogacao">Revogação</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-gray-400 font-medium mb-1">
                        Texto original
                        <span class="text-gray-300 font-normal">(redação anterior)</span>
                      </label>
                      <EditorTexto v-model="trecho.texto_original" minHeight="120px" />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-400 font-medium mb-1">
                        Texto novo
                        <span class="text-gray-300 font-normal">(nova redação)</span>
                      </label>
                      <EditorTexto v-model="trecho.texto_novo" minHeight="120px" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <p class="text-xs text-gray-400">
            <span v-if="novoVinculo.trechos.length > 0">{{ novoVinculo.trechos.length }} trecho(s) adicionado(s)</span>
          </p>
          <div class="flex gap-3">
            <button @click="modalVinculo = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">
              Cancelar
            </button>
            <button
              @click="salvarVinculo"
              :disabled="salvandoVinculo || !novoVinculo.id_lei_origem"
              class="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-green-800 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
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
    </div>
  </teleport>
</template>
