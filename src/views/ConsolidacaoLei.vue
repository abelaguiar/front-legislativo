<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../services/api.js'
import AppHeader from '../components/AppHeader.vue'

// ── Lei a ser alterada (coluna esquerda) ──────────────────────────────────
const buscaAlterada   = ref('')
const resultadosAlterada = ref([])
const buscandoAlterada   = ref(false)
const leiAlterada    = ref(null)
const versaoAlterada = ref(null)
const artigosAlterada = ref([])

// ── Lei alteradora (coluna do meio) ───────────────────────────────────────
const buscaAlteradora   = ref('')
const resultadosAlteradora = ref([])
const buscandoAlteradora   = ref(false)
const leiAlteradora    = ref(null)
const versaoAlteradora = ref(null)
const artigosAlteradora = ref([])

// ── Consolidado (coluna direita) ──────────────────────────────────────────
const artigosConsolidados = ref([])
const erroAlterada    = ref('')
const erroAlteradora  = ref('')

// ─────────────────────── Parsear artigos do HTML ──────────────────────────
function parsearArtigos(html) {
  if (!html) return []
  const div = document.createElement('div')
  div.innerHTML = html
  const texto = (div.textContent || div.innerText || '').replace(/\r/g, '')

  const artigos = []
  // Divide no padrão "Art. 1°" ou "Art. 1º" ou "Art. 1."
  const blocos = texto.split(/(?=\bArt\.\s*\d)/i)

  for (const bloco of blocos) {
    const trimmed = bloco.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^(Art\.\s*[\d]+[°º]?(?:\s*-\s*[A-Z])?)\s*[.–—]?\s*([\s\S]+)$/)
    if (match) {
      artigos.push({
        id:    match[1].trim(),
        texto: match[2].trim().replace(/\s+/g, ' '),
      })
    }
  }
  return artigos
}

// ─────────────────────── Detectar mudanças no texto da lei alteradora ─────
function detectarMudancas(artigos) {
  const mudancas = []

  for (const art of artigos) {
    const t = art.texto

    // Revogação: "Revoga o art. X" / "fica revogado o art. X"
    const mRevoga = t.match(/(?:revog\w*)\s+o?\s*(?:art\.\s*)([\d]+[°º]?(?:\s*-\s*[A-Z])?)/i)
    if (mRevoga) {
      mudancas.push({ tipo: 'revogacao', referencia: `Art. ${mRevoga[1]}`, artigo: art })
      continue
    }

    // Supressão: "fica suprimido o art. X" / "suprime o art. X"
    const mSuprime = t.match(/suprim\w*\s+o?\s*(?:art\.\s*)([\d]+[°º]?(?:\s*-\s*[A-Z])?)/i)
    if (mSuprime) {
      mudancas.push({ tipo: 'supressao', referencia: `Art. ${mSuprime[1]}`, artigo: art })
      continue
    }

    // Acréscimo / Inclusão: "fica acrescido o art. X-A" / "acrescenta o art. X"
    const mAcrescimo = t.match(/(?:acrescid\w*|acrescenta\w*)\s+o?\s*(?:art\.\s*)([\d]+[°º]?(?:\s*-\s*[A-Z])?)/i)
    if (mAcrescimo) {
      mudancas.push({ tipo: 'inclusao', referencia: `Art. ${mAcrescimo[1]}`, artigo: art })
      continue
    }

    // Alteração (nova redação): "passa a vigorar" / "com a seguinte redação"
    const mAltera = t.match(/(?:art\.\s*)([\d]+[°º]?(?:\s*-\s*[A-Z])?).*(?:seguinte redação|nova redação|passa a vigorar)/i)
    if (mAltera) {
      mudancas.push({ tipo: 'alteracao', referencia: `Art. ${mAltera[1]}`, artigo: art })
    }
  }

  return mudancas
}

// Mudanças identificadas — exibidas como tags na coluna do meio
const mudancasIdentificadas = computed(() => detectarMudancas(artigosAlteradora.value))

// Metadados visuais por tipo de mudança
const tipoMudanca = {
  revogacao: { label: 'Revogação', cor: 'bg-red-100 text-red-700 border-red-200'  },
  supressao: { label: 'Supressão', cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  inclusao:  { label: 'Inclusão',  cor: 'bg-green-100 text-green-700 border-green-200' },
  alteracao: { label: 'Alteração', cor: 'bg-blue-100 text-blue-700 border-blue-200'  },
}

// ─────────────────────── Gerar consolidado ───────────────────────────────
function gerarConsolidado() {
  if (!leiAlterada.value) { artigosConsolidados.value = []; return }

  const mudancas = mudancasIdentificadas.value

  const arts = artigosAlterada.value.map(art => {
    const numLimpo = art.id.replace(/^Art\.\s*/i, '').replace(/[°º]/g, '').trim()
    const mudanca  = mudancas.find(m => {
      const mNum = m.referencia.replace(/^Art\.\s*/i, '').replace(/[°º]/g, '').trim()
      return mNum === numLimpo
    }) ?? null

    return { ...art, mudanca, validado: false }
  })

  // Artigos adicionados pela lei alteradora
  for (const m of mudancas) {
    if (m.tipo === 'inclusao') {
      const existe = arts.find(a => a.id === m.referencia)
      if (!existe) {
        arts.push({ id: m.referencia, texto: '', mudanca: m, validado: false, novo: true })
      }
    }
  }

  artigosConsolidados.value = arts
}

watch([artigosAlterada, artigosAlteradora], gerarConsolidado)

// ─────────────────────── Busca com debounce ──────────────────────────────
let timerAlterada   = null
let timerAlteradora = null

function debounceAlterada() {
  clearTimeout(timerAlterada)
  if (!buscaAlterada.value.trim()) { resultadosAlterada.value = []; return }
  timerAlterada = setTimeout(buscarAlterada, 380)
}

async function buscarAlterada() {
  buscandoAlterada.value = true
  erroAlterada.value = ''
  try {
    const res = await api.leis.listar({ 'filter[numero]': buscaAlterada.value.trim() })
    resultadosAlterada.value = res.data ?? []
  } catch (e) {
    erroAlterada.value = e.message
  } finally {
    buscandoAlterada.value = false
  }
}

async function selecionarAlterada(lei) {
  leiAlterada.value      = lei
  resultadosAlterada.value = []
  buscaAlterada.value    = ''
  erroAlterada.value     = ''
  try {
    const versoes = await api.leis.versoes(lei.id_lei)
    versaoAlterada.value = versoes?.find(v => v.versao_atual) ?? versoes?.[0] ?? null
    artigosAlterada.value = parsearArtigos(versaoAlterada.value?.texto_integral ?? '')
  } catch (e) {
    erroAlterada.value = e.message
  }
}

function limparAlterada() {
  leiAlterada.value    = null
  versaoAlterada.value = null
  artigosAlterada.value = []
  artigosConsolidados.value = []
}

function debounceAlteradora() {
  clearTimeout(timerAlteradora)
  if (!buscaAlteradora.value.trim()) { resultadosAlteradora.value = []; return }
  timerAlteradora = setTimeout(buscarAlteradora, 380)
}

async function buscarAlteradora() {
  buscandoAlteradora.value = true
  erroAlteradora.value = ''
  try {
    const res = await api.leis.listar({ 'filter[numero]': buscaAlteradora.value.trim() })
    resultadosAlteradora.value = res.data ?? []
  } catch (e) {
    erroAlteradora.value = e.message
  } finally {
    buscandoAlteradora.value = false
  }
}

async function selecionarAlteradora(lei) {
  leiAlteradora.value        = lei
  resultadosAlteradora.value = []
  buscaAlteradora.value      = ''
  erroAlteradora.value       = ''
  try {
    const versoes = await api.leis.versoes(lei.id_lei)
    versaoAlteradora.value = versoes?.find(v => v.versao_atual) ?? versoes?.[0] ?? null
    artigosAlteradora.value = parsearArtigos(versaoAlteradora.value?.texto_integral ?? '')
  } catch (e) {
    erroAlteradora.value = e.message
  }
}

function limparAlteradora() {
  leiAlteradora.value    = null
  versaoAlteradora.value = null
  artigosAlteradora.value = []
}

// ─────────────────────── Ações do painel consolidado ─────────────────────
function validarAlteracao(art) {
  art.validado = true
}

function desfazerValidacao(art) {
  art.validado = false
}

// Botões do fluxo (stubs — a lógica completa depende do backend)
function padronizarFormatacao() { /* TODO */ }
function consolidacaoAutomatica() {
  if (!leiAlterada.value || !leiAlteradora.value) return
  artigosConsolidados.value.forEach(art => {
    if (art.mudanca && !art.validado) validarAlteracao(art)
  })
}
function visualizarComAlteracoes()  { /* TODO: abrir modal/nova aba */ }
function visualizarConsolidada()    { /* TODO: abrir modal/nova aba */ }
function publicar() { /* TODO */ }

// ─────────────────────── Helpers de exibição ─────────────────────────────
function labelLei(lei) {
  return `Lei n.° ${lei.numero}/${lei.ano}`
}

function textoResumido(texto, max = 120) {
  if (!texto) return ''
  return texto.length > max ? texto.slice(0, max) + '…' : texto
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <AppHeader />

    <!-- Três colunas preenchendo o restante da tela -->
    <div class="flex-1 flex overflow-hidden">

      <!-- ════════════════ COLUNA ESQUERDA — Lei a ser alterada ════════════ -->
      <div class="w-1/3 flex flex-col border-r border-gray-200 bg-white overflow-hidden">

        <!-- Barra de busca -->
        <div class="p-3 border-b border-gray-100 relative">
          <div class="relative">
            <svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input
              v-model="buscaAlterada"
              @input="debounceAlterada"
              type="text"
              placeholder="Pesquisar lei (número/ano)"
              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
            />
            <span v-if="buscandoAlterada" class="absolute right-2.5 top-2.5">
              <svg class="w-4 h-4 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </span>
          </div>

          <!-- Dropdown de resultados da busca -->
          <ul v-if="resultadosAlterada.length" class="absolute z-20 left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-sm">
            <li
              v-for="lei in resultadosAlterada"
              :key="lei.id_lei"
              @click="selecionarAlterada(lei)"
              class="px-3 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-none"
            >
              <span class="font-medium text-gray-900">Lei nº {{ lei.numero }}/{{ lei.ano }}</span>
              <span v-if="lei.versao_atual?.ementa" class="block text-xs text-gray-500 mt-0.5 truncate">
                {{ lei.versao_atual.ementa }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Cabeçalho da lei selecionada -->
        <div v-if="leiAlterada" class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-green-800">
            {{ labelLei(leiAlterada) }} — <span class="font-normal">Lei a ser alterada</span>
          </h2>
          <button @click="limparAlterada" class="text-gray-400 hover:text-gray-600 transition p-0.5 rounded" title="Remover lei">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Mensagem de erro -->
        <p v-if="erroAlterada" class="mx-4 mt-2 text-xs text-red-600">{{ erroAlterada }}</p>

        <!-- Lista de artigos -->
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">

          <div v-if="!leiAlterada" class="flex flex-col items-center justify-center h-40 text-center text-gray-400 gap-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="text-xs">Pesquise a lei a ser alterada</span>
          </div>

          <div v-else-if="artigosAlterada.length === 0" class="text-xs text-gray-400 italic py-4 text-center">
            Nenhum artigo identificado no texto desta lei.
          </div>

          <template v-else>
            <div
              v-for="art in artigosAlterada"
              :key="art.id"
              :class="[
                'rounded-lg border px-3 py-2.5 text-sm transition',
                mudancasIdentificadas.some(m => m.referencia === art.id)
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white'
              ]"
            >
              <p class="font-bold text-gray-800 mb-1">{{ art.id }}</p>

              <!-- Badge de dispositivo afetado -->
              <template v-if="mudancasIdentificadas.some(m => m.referencia === art.id)">
                <span
                  v-for="m in mudancasIdentificadas.filter(m => m.referencia === art.id)"
                  :key="m.tipo"
                  class="inline-block text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 mb-1.5 mr-1"
                >
                  DISPOSITIVO AFETADO: proposta de {{ tipoMudanca[m.tipo]?.label.toLowerCase() }}
                </span>
              </template>

              <p class="text-gray-600 leading-snug text-xs">{{ textoResumido(art.texto) }}</p>
            </div>
          </template>
        </div>
      </div>

      <!-- ════════════════ COLUNA DO MEIO — Lei alteradora ════════════════ -->
      <div class="w-1/3 flex flex-col border-r border-gray-200 bg-white overflow-hidden">

        <!-- Barra de busca -->
        <div class="p-3 border-b border-gray-100 relative">
          <div class="relative">
            <svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input
              v-model="buscaAlteradora"
              @input="debounceAlteradora"
              type="text"
              placeholder="Pesquisar lei (número/ano)"
              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
            />
            <span v-if="buscandoAlteradora" class="absolute right-2.5 top-2.5">
              <svg class="w-4 h-4 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </span>
          </div>

          <!-- Dropdown -->
          <ul v-if="resultadosAlteradora.length" class="absolute z-20 left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-sm">
            <li
              v-for="lei in resultadosAlteradora"
              :key="lei.id_lei"
              @click="selecionarAlteradora(lei)"
              class="px-3 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-none"
            >
              <span class="font-medium text-gray-900">Lei nº {{ lei.numero }}/{{ lei.ano }}</span>
              <span v-if="lei.versao_atual?.ementa" class="block text-xs text-gray-500 mt-0.5 truncate">
                {{ lei.versao_atual.ementa }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Cabeçalho + tags de mudanças identificadas -->
        <div v-if="leiAlteradora" class="px-4 pt-3 pb-2 border-b border-gray-100">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-green-800">
              {{ labelLei(leiAlteradora) }} — <span class="font-normal">Lei alteradora</span>
            </h2>
            <button @click="limparAlteradora" class="text-gray-400 hover:text-gray-600 transition p-0.5 rounded" title="Remover lei">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div v-if="mudancasIdentificadas.length" class="flex flex-wrap gap-1 items-center">
            <span class="text-[10px] text-gray-500 mr-1">Dispositivos identificados para alteração:</span>
            <span
              v-for="(m, i) in mudancasIdentificadas"
              :key="i"
              :class="['text-[10px] font-semibold border rounded px-1.5 py-0.5', tipoMudanca[m.tipo]?.cor ?? 'bg-gray-100 text-gray-700']"
            >
              {{ tipoMudanca[m.tipo]?.label }}: {{ m.referencia }}
            </span>
          </div>
        </div>

        <!-- Erro -->
        <p v-if="erroAlteradora" class="mx-4 mt-2 text-xs text-red-600">{{ erroAlteradora }}</p>

        <!-- Artigos da lei alteradora -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-100">

          <div v-if="!leiAlteradora" class="flex flex-col items-center justify-center h-40 text-center text-gray-400 gap-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="text-xs">Pesquise a lei alteradora</span>
          </div>

          <div v-else-if="artigosAlteradora.length === 0" class="text-xs text-gray-400 italic py-4 text-center">
            Nenhum artigo identificado no texto desta lei.
          </div>

          <template v-else>
            <div
              v-for="art in artigosAlteradora"
              :key="art.id"
              class="px-4 py-3 text-sm"
            >
              <p class="font-bold text-gray-800 mb-1">{{ art.id }}</p>
              <p class="text-gray-700 leading-relaxed text-xs whitespace-pre-line">{{ art.texto }}</p>
            </div>
          </template>
        </div>
      </div>

      <!-- ════════════════ COLUNA DIREITA — Em Consolidação ═══════════════ -->
      <div class="w-1/3 flex flex-col bg-gray-50 overflow-hidden">

        <!-- Cabeçalho -->
        <div class="px-4 py-3 border-b border-gray-200 bg-white">
          <h2 class="text-sm font-semibold text-green-800">
            <template v-if="leiAlterada">{{ labelLei(leiAlterada) }} — Em Consolidação</template>
            <template v-else>— Em Consolidação</template>
          </h2>
        </div>

        <!-- Conteúdo -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          <div v-if="!leiAlterada" class="flex flex-col items-center justify-center h-40 text-center text-gray-400 gap-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="text-xs">Selecione as leis para iniciar a consolidação</span>
          </div>

          <template v-else>
            <!-- Fluxo de ações -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
              <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Fluxo da Consolidação</p>

              <div class="grid grid-cols-2 gap-2 mb-3">
                <button
                  @click="padronizarFormatacao"
                  class="text-xs font-medium px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 transition text-gray-700"
                >
                  Padronizar formatação
                </button>
                <button
                  @click="consolidacaoAutomatica"
                  :disabled="!leiAlteradora"
                  class="text-xs font-medium px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 transition text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Consolidação automática
                </button>
                <button
                  @click="visualizarComAlteracoes"
                  :disabled="!leiAlteradora"
                  class="text-xs font-medium px-2 py-1.5 rounded border border-teal-300 bg-teal-50 hover:bg-teal-100 transition text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Visualizar lei com alterações
                </button>
                <button
                  @click="visualizarConsolidada"
                  :disabled="!leiAlteradora"
                  class="text-xs font-medium px-2 py-1.5 rounded border border-teal-300 bg-teal-50 hover:bg-teal-100 transition text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Visualizar lei consolidada
                </button>
              </div>

              <button
                @click="publicar"
                class="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white transition"
              >
                Publicar
              </button>
            </div>

            <!-- Artigos consolidados -->
            <div
              v-for="art in artigosConsolidados"
              :key="art.id"
              :class="[
                'rounded-xl border shadow-sm px-4 py-3 text-sm bg-white',
                art.mudanca && !art.validado ? 'border-orange-200' : 'border-gray-200',
              ]"
            >
              <p class="font-bold text-gray-800 mb-1.5">{{ art.id }}</p>

              <!-- Artigo COM mudança pendente -->
              <template v-if="art.mudanca && !art.validado">
                <span :class="['inline-block text-xs font-semibold border rounded px-2 py-0.5 mb-2', tipoMudanca[art.mudanca.tipo]?.cor]">
                  proposta de {{ tipoMudanca[art.mudanca.tipo]?.label.toLowerCase() }}
                  <template v-if="leiAlteradora"> pela {{ labelLei(leiAlteradora) }}</template>
                </span>

                <div class="flex gap-2 mb-2">
                  <button
                    @click="validarAlteracao(art)"
                    class="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border border-green-400 bg-white text-green-700 hover:bg-green-50 transition"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round"/>
                    </svg>
                    Validar alteração
                  </button>
                  <button
                    class="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    Alterar manualmente
                  </button>
                </div>

                <!-- Texto tachado (revogação / supressão) -->
                <p
                  v-if="art.mudanca.tipo === 'revogacao' || art.mudanca.tipo === 'supressao'"
                  class="text-xs text-red-600 line-through leading-snug"
                >
                  {{ textoResumido(art.texto, 200) }}
                </p>
                <!-- Texto de acréscimo -->
                <p v-else-if="art.mudanca.tipo === 'inclusao'" class="text-xs text-green-700 leading-snug italic">
                  {{ textoResumido(art.mudanca.artigo.texto, 200) }}
                </p>
                <!-- Alteração de redação -->
                <p v-else class="text-xs text-blue-700 leading-snug">
                  {{ textoResumido(art.mudanca.artigo.texto, 200) }}
                </p>
              </template>

              <!-- Artigo COM mudança já validada -->
              <template v-else-if="art.mudanca && art.validado">
                <span class="inline-flex items-center gap-1 text-xs font-semibold text-green-700 mb-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  Alteração validada
                  <button @click="desfazerValidacao(art)" class="ml-1 text-gray-400 hover:text-gray-600">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
                <p
                  :class="[
                    'text-xs leading-snug',
                    (art.mudanca.tipo === 'revogacao' || art.mudanca.tipo === 'supressao')
                      ? 'text-gray-400 line-through'
                      : 'text-gray-700'
                  ]"
                >
                  {{ textoResumido(art.texto || art.mudanca.artigo.texto, 200) }}
                </p>
              </template>

              <!-- Artigo SEM mudança -->
              <template v-else>
                <p class="text-xs text-gray-500 leading-snug">{{ textoResumido(art.texto, 150) }}</p>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
