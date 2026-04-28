<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../services/api.js'
import AppHeader from '../components/AppHeader.vue'
import EditorTexto from '../components/EditorTexto.vue'

const buscaLei = ref('')
const resultados = ref([])
const buscando = ref(false)
const buscaAlteradora = ref('')
const resultadosAlteradora = ref([])
const buscandoAlteradora = ref(false)
const carregandoPainel = ref(false)
const executando = ref('')
const erro = ref('')
const aviso = ref('')

const leiAlvo = ref(null)
const leiAlteradora = ref(null)
const versoes = ref([])
const versaoId = ref(null)
const painel = ref(null)
const visualizacao = ref('marcacoes')

const trechoEditandoId = ref(null)
const textoManual = ref('')
const notasCurador = ref('')

let buscaTimer = null
let buscaAlteradoraTimer = null

const versaoSelecionada = computed(() =>
  versoes.value.find(v => v.id_versao_lei === versaoId.value) ?? painel.value?.versao_alvo ?? null
)

const resumo = computed(() => painel.value?.resumo ?? {
  total_vinculos: 0,
  total_trechos: 0,
  trechos_pendentes: 0,
  trechos_validados: 0,
  trechos_com_ajuste_manual: 0,
})

const dispositivosConsolidacao = computed(() => {
  if (!painel.value) return []
  return visualizacao.value === 'consolidada'
    ? painel.value.dispositivos_consolidados ?? []
    : painel.value.dispositivos_base ?? []
})

const textoPreview = computed(() => {
  if (!painel.value) return ''
  if (visualizacao.value === 'consolidada') return painel.value.texto_consolidado_sugerido ?? ''
  return painel.value.versao_alvo?.texto_integral ?? ''
})

watch(versaoId, async (novo, antigo) => {
  if (!leiAlvo.value || !novo || novo === antigo) return
  await carregarPainel()
})

function debounceBusca() {
  clearTimeout(buscaTimer)
  resultados.value = []
  if (!buscaLei.value.trim()) return
  buscaTimer = setTimeout(buscarLeis, 350)
}

async function buscarLeis() {
  buscando.value = true
  erro.value = ''
  try {
    const termo = buscaLei.value.trim()
    const numero = termo.split('/')[0]?.trim()
    const res = await api.leis.listar({ 'filter[numero]': numero, per_page: 10 })
    resultados.value = res.data ?? []
  } catch (e) {
    erro.value = e.message
  } finally {
    buscando.value = false
  }
}

function debounceBuscaAlteradora() {
  clearTimeout(buscaAlteradoraTimer)
  resultadosAlteradora.value = []
  if (!buscaAlteradora.value.trim()) return
  buscaAlteradoraTimer = setTimeout(buscarLeisAlteradoras, 350)
}

async function buscarLeisAlteradoras() {
  buscandoAlteradora.value = true
  erro.value = ''
  try {
    const termo = buscaAlteradora.value.trim()
    const numero = termo.split('/')[0]?.trim()
    const res = await api.leis.listar({ 'filter[numero]': numero, per_page: 10 })
    resultadosAlteradora.value = (res.data ?? []).filter(lei => lei.id_lei !== leiAlvo.value?.id_lei)
  } catch (e) {
    erro.value = e.message
  } finally {
    buscandoAlteradora.value = false
  }
}

async function selecionarLei(lei) {
  leiAlvo.value = lei
  leiAlteradora.value = null
  buscaAlteradora.value = ''
  resultadosAlteradora.value = []
  buscaLei.value = ''
  resultados.value = []
  painel.value = null
  erro.value = ''
  aviso.value = ''
  visualizacao.value = 'marcacoes'

  try {
    versoes.value = await api.leis.versoes(lei.id_lei)
    const atual = versoes.value.find(v => v.versao_atual)
    versaoId.value = atual?.id_versao_lei ?? versoes.value[0]?.id_versao_lei ?? null
    if (versaoId.value) await carregarPainel()
  } catch (e) {
    erro.value = e.message
  }
}

function selecionarLeiAlteradora(lei) {
  leiAlteradora.value = lei
  buscaAlteradora.value = ''
  resultadosAlteradora.value = []
  erro.value = ''
  aviso.value = ''
}

function limparAlteradora() {
  leiAlteradora.value = null
  buscaAlteradora.value = ''
  resultadosAlteradora.value = []
}

async function carregarPainel() {
  if (!leiAlvo.value || !versaoId.value) return
  carregandoPainel.value = true
  erro.value = ''
  try {
    painel.value = await api.leis.painelConsolidacao(leiAlvo.value.id_lei, versaoId.value)
  } catch (e) {
    erro.value = e.message
  } finally {
    carregandoPainel.value = false
  }
}

function limparSelecao() {
  leiAlvo.value = null
  leiAlteradora.value = null
  versoes.value = []
  versaoId.value = null
  painel.value = null
  resultados.value = []
  erro.value = ''
  aviso.value = ''
  cancelarEdicao()
}

async function executar(nome, acao, mensagem) {
  if (!leiAlvo.value || !versaoId.value) return
  executando.value = nome
  erro.value = ''
  aviso.value = ''
  try {
    await acao()
    await carregarPainel()
    aviso.value = mensagem
  } catch (e) {
    erro.value = e.message
  } finally {
    executando.value = ''
  }
}

function padronizarFormatacao() {
  const campo = visualizacao.value === 'consolidada' ? 'texto_consolidado' : 'texto_integral'
  return executar(
    'padronizar',
    () => api.leis.padronizarVersao(leiAlvo.value.id_lei, versaoId.value, { campo }),
    'Formatação padronizada.',
  )
}

function consolidacaoAutomatica() {
  return executar(
    'consolidar',
    () => api.vinculos.consolidar(leiAlvo.value.id_lei, versaoId.value, {}),
    'Texto consolidado gerado.',
  ).then(() => {
    visualizacao.value = 'consolidada'
  })
}

function analisarAlteradora() {
  if (!leiAlvo.value || !versaoId.value || !leiAlteradora.value) return
  return executar(
    'analisar-alteradora',
    async () => {
      const analise = await api.leis.analisarAlteradora(leiAlvo.value.id_lei, versaoId.value, {
        id_lei_origem: leiAlteradora.value.id_lei,
        persistir: true,
      })
      if (analise?.painel) painel.value = analise.painel
    },
    'Lei alteradora analisada e vinculada.',
  )
}

function publicar() {
  return executar(
    'publicar',
    () => api.leis.publicarVersao(leiAlvo.value.id_lei, versaoId.value),
    'Versão publicada.',
  )
}

function visualizarComAlteracoes() {
  visualizacao.value = 'marcacoes'
}

function visualizarConsolidada() {
  visualizacao.value = 'consolidada'
}

function vinculoDoTrecho(trecho) {
  return painel.value?.leis_alteradoras?.find(v =>
    v.trechos?.some(t => t.id_trecho === trecho.id_trecho)
  ) ?? null
}

async function validarTrecho(trecho) {
  const vinculo = vinculoDoTrecho(trecho)
  if (!vinculo) return
  await executar(
    `validar-${trecho.id_trecho}`,
    () => api.vinculos.atualizarTrecho(leiAlvo.value.id_lei, vinculo.id_lei_vinculo, trecho.id_trecho, {
      status_validacao: 'validado',
    }),
    'Alteração validada.',
  )
}

async function reabrirTrecho(trecho) {
  const vinculo = vinculoDoTrecho(trecho)
  if (!vinculo) return
  await executar(
    `reabrir-${trecho.id_trecho}`,
    () => api.vinculos.atualizarTrecho(leiAlvo.value.id_lei, vinculo.id_lei_vinculo, trecho.id_trecho, {
      status_validacao: 'pendente',
    }),
    'Alteração reaberta para revisão.',
  )
}

function iniciarEdicao(trecho) {
  trechoEditandoId.value = trecho.id_trecho
  textoManual.value = trecho.texto_manual ?? trecho.texto_novo ?? ''
  notasCurador.value = trecho.notas_curador ?? ''
}

function cancelarEdicao() {
  trechoEditandoId.value = null
  textoManual.value = ''
  notasCurador.value = ''
}

async function salvarEdicao(trecho) {
  const vinculo = vinculoDoTrecho(trecho)
  if (!vinculo) return
  await executar(
    `editar-${trecho.id_trecho}`,
    () => api.vinculos.atualizarTrecho(leiAlvo.value.id_lei, vinculo.id_lei_vinculo, trecho.id_trecho, {
      status_validacao: 'ajuste_manual',
      texto_manual: textoManual.value,
      notas_curador: notasCurador.value,
    }),
    'Ajuste manual salvo.',
  )
  cancelarEdicao()
}

function labelLei(lei) {
  if (!lei) return 'Lei'
  return `Lei nº ${lei.numero}/${lei.ano}`
}

function labelTipo(tipo) {
  const tipos = {
    substituicao: 'Substituição',
    acrescimo: 'Acréscimo',
    revogacao: 'Revogação',
    altera: 'Altera',
    complementa: 'Complementa',
    revoga: 'Revoga',
    acrescenta: 'Acrescenta',
  }
  return tipos[tipo] ?? tipo ?? 'Alteração'
}

function classeTipo(tipo) {
  if (tipo === 'revogacao' || tipo === 'revoga') return 'bg-red-50 text-red-700 border-red-200'
  if (tipo === 'acrescimo' || tipo === 'acrescenta') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (tipo === 'substituicao' || tipo === 'altera') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

function classeStatus(status) {
  if (status === 'validado') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'ajuste_manual') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function labelStatus(status) {
  if (status === 'validado') return 'Validado'
  if (status === 'ajuste_manual') return 'Ajuste manual'
  return 'Pendente'
}

function contemHtml(texto) {
  return /<\/?[a-z][\s\S]*>/i.test(String(texto ?? ''))
}

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderizarHtml(texto) {
  if (!texto) return '<span class="text-gray-400">—</span>'
  if (contemHtml(texto)) return texto
  return escaparHtml(texto).replace(/\n/g, '<br>')
}

function formatarData(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : data
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <AppHeader />

    <main class="flex-1 flex flex-col overflow-hidden">
      <section class="bg-white border-b border-gray-200 px-5 py-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold text-gray-900">Consolidação legislativa</h1>
            <p class="text-xs text-gray-500 mt-0.5">
              Selecione a lei alvo para revisar vínculos, validar trechos e publicar a versão consolidada.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div class="relative w-full sm:w-80">
              <svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                v-model="buscaLei"
                @input="debounceBusca"
                type="text"
                placeholder="Buscar lei alvo por número"
                class="w-full pl-8 pr-9 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
              />
              <span v-if="buscando" class="absolute right-2.5 top-2.5">
                <svg class="w-4 h-4 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>

              <ul v-if="resultados.length" class="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-sm">
                <li
                  v-for="lei in resultados"
                  :key="lei.id_lei"
                  @click="selecionarLei(lei)"
                  class="px-3 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-none"
                >
                  <span class="font-medium text-gray-900">Lei nº {{ lei.numero }}/{{ lei.ano }}</span>
                  <span v-if="lei.versao_atual?.ementa" class="block text-xs text-gray-500 mt-0.5 truncate">
                    {{ lei.versao_atual.ementa }}
                  </span>
                </li>
              </ul>
            </div>

            <div v-if="leiAlvo" class="relative w-full sm:w-80">
              <svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                v-model="buscaAlteradora"
                @input="debounceBuscaAlteradora"
                type="text"
                placeholder="Buscar lei alteradora"
                class="w-full pl-8 pr-9 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
              />
              <span v-if="buscandoAlteradora" class="absolute right-2.5 top-2.5">
                <svg class="w-4 h-4 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>

              <ul v-if="resultadosAlteradora.length" class="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-sm">
                <li
                  v-for="lei in resultadosAlteradora"
                  :key="lei.id_lei"
                  @click="selecionarLeiAlteradora(lei)"
                  class="px-3 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-none"
                >
                  <span class="font-medium text-gray-900">Lei nº {{ lei.numero }}/{{ lei.ano }}</span>
                  <span v-if="lei.versao_atual?.ementa" class="block text-xs text-gray-500 mt-0.5 truncate">
                    {{ lei.versao_atual.ementa }}
                  </span>
                </li>
              </ul>
            </div>

            <select
              v-if="versoes.length"
              v-model="versaoId"
              class="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              <option v-for="v in versoes" :key="v.id_versao_lei" :value="v.id_versao_lei">
                Versão {{ v.numero_versao }} · {{ formatarData(v.data_publicacao) }}
              </option>
            </select>

            <button
              v-if="leiAlvo"
              @click="limparSelecao"
              class="h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50"
            >
              Limpar
            </button>
          </div>
        </div>

        <div v-if="leiAlvo" class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span class="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-medium text-green-800">
            {{ labelLei(leiAlvo) }}
          </span>
          <span class="text-gray-500">{{ versaoSelecionada?.ementa ?? 'Sem ementa' }}</span>
          <template v-if="leiAlteradora">
            <span class="text-gray-300">/</span>
            <span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-800">
              Alteradora: {{ labelLei(leiAlteradora) }}
              <button @click="limparAlteradora" class="text-blue-500 hover:text-blue-700" title="Remover lei alteradora">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <button
              @click="analisarAlteradora"
              :disabled="!!executando"
              class="h-7 rounded-md border border-blue-300 bg-white px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-45"
            >
              {{ executando === 'analisar-alteradora' ? 'Analisando...' : 'Analisar alteradora' }}
            </button>
          </template>
        </div>
      </section>

      <div v-if="erro" class="mx-5 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ erro }}
      </div>
      <div v-if="aviso" class="mx-5 mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        {{ aviso }}
      </div>

      <section class="flex-1 min-h-0 p-4">
        <div v-if="!leiAlvo" class="h-full rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-center">
          <div class="max-w-sm px-6">
            <svg class="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-sm font-medium text-gray-700">Busque uma lei alvo para iniciar a consolidação.</p>
          </div>
        </div>

        <div v-else-if="carregandoPainel" class="h-full rounded-lg border border-gray-200 bg-white flex items-center justify-center">
          <svg class="w-7 h-7 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>

        <div v-else class="h-full grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0">
          <section class="bg-white border border-gray-200 rounded-lg flex flex-col min-h-0 overflow-hidden">
            <header class="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Lei a ser alterada</p>
              <h2 class="text-sm font-semibold text-green-800 mt-0.5">{{ labelLei(painel?.lei_alvo ?? leiAlvo) }}</h2>
            </header>

            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <div
                v-for="dispositivo in painel?.dispositivos_base ?? []"
                :key="dispositivo.referencia"
                :class="[
                  'rounded-md border px-3 py-2.5 text-sm',
                  dispositivo.afetado ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white',
                ]"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="font-semibold text-gray-900">{{ dispositivo.titulo }}</p>
                  <span v-if="dispositivo.afetado" class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Afetado
                  </span>
                </div>
                <div class="conteudo-html conteudo-html--compact mt-1 text-gray-600" v-html="renderizarHtml(dispositivo.texto)"></div>
              </div>

              <p v-if="!painel?.dispositivos_base?.length" class="text-sm text-gray-400 text-center py-8">
                Nenhum dispositivo identificado no texto integral.
              </p>
            </div>
          </section>

          <section class="bg-white border border-gray-200 rounded-lg flex flex-col min-h-0 overflow-hidden">
            <header class="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Leis alteradoras</p>
                  <h2 class="text-sm font-semibold text-green-800 mt-0.5">{{ resumo.total_vinculos }} vínculo(s)</h2>
                </div>
                <div class="text-right text-xs text-gray-500">
                  <p>{{ resumo.total_trechos }} trecho(s)</p>
                  <p>{{ resumo.trechos_pendentes }} pendente(s)</p>
                </div>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto p-3 space-y-3">
              <div
                v-for="vinculo in painel?.leis_alteradoras ?? []"
                :key="vinculo.id_lei_vinculo"
                class="rounded-md border border-gray-200 bg-white overflow-hidden"
              >
                <div class="px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div class="flex items-center gap-2 mb-1">
                    <span :class="['rounded-full border px-2 py-0.5 text-[10px] font-semibold', classeTipo(vinculo.tipo_vinculo)]">
                      {{ labelTipo(vinculo.tipo_vinculo) }}
                    </span>
                    <span class="text-sm font-semibold text-gray-900">{{ labelLei(vinculo.lei_origem) }}</span>
                  </div>
                  <p class="text-xs text-gray-500">{{ vinculo.versao_origem?.ementa ?? 'Sem ementa' }}</p>
                </div>

                <div class="divide-y divide-gray-100">
                  <article v-for="trecho in vinculo.trechos" :key="trecho.id_trecho" class="px-3 py-3">
                    <div class="flex flex-wrap items-center gap-1.5 mb-2">
                      <span :class="['rounded border px-1.5 py-0.5 text-[10px] font-semibold', classeTipo(trecho.tipo)]">
                        {{ labelTipo(trecho.tipo) }}
                      </span>
                      <span :class="['rounded border px-1.5 py-0.5 text-[10px] font-semibold', classeStatus(trecho.status_validacao)]">
                        {{ labelStatus(trecho.status_validacao) }}
                      </span>
                      <span class="text-xs text-gray-500">{{ trecho.referencia }}</span>
                    </div>

                    <div class="space-y-1.5 text-xs">
                      <div
                        v-if="trecho.texto_original"
                        class="conteudo-html conteudo-html--compact rounded bg-red-50 px-2 py-1.5 text-red-800 line-through"
                        v-html="renderizarHtml(trecho.texto_original)"
                      ></div>
                      <div
                        v-if="trecho.texto_aplicavel"
                        class="conteudo-html conteudo-html--compact rounded bg-green-50 px-2 py-1.5 text-green-800"
                        v-html="renderizarHtml(trecho.texto_aplicavel)"
                      ></div>
                    </div>

                    <div class="mt-2 flex flex-wrap gap-2">
                      <button
                        @click="validarTrecho(trecho)"
                        :disabled="executando === `validar-${trecho.id_trecho}` || trecho.status_validacao === 'validado'"
                        class="rounded border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        Validar
                      </button>
                      <button
                        @click="iniciarEdicao(trecho)"
                        class="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Alterar manualmente
                      </button>
                      <button
                        v-if="trecho.status_validacao !== 'pendente'"
                        @click="reabrirTrecho(trecho)"
                        :disabled="executando === `reabrir-${trecho.id_trecho}`"
                        class="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-45"
                      >
                        Reabrir
                      </button>
                    </div>

                    <div v-if="trechoEditandoId === trecho.id_trecho" class="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2">
                      <label class="block text-[10px] font-semibold uppercase tracking-wide text-blue-800 mb-1">Texto manual</label>
                      <EditorTexto v-model="textoManual" minHeight="150px" />
                      <label class="block text-[10px] font-semibold uppercase tracking-wide text-blue-800 mt-2 mb-1">Notas do curador</label>
                      <EditorTexto v-model="notasCurador" minHeight="90px" />
                      <div class="mt-2 flex gap-2">
                        <button
                          @click="salvarEdicao(trecho)"
                          :disabled="executando === `editar-${trecho.id_trecho}`"
                          class="rounded bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                          Salvar ajuste
                        </button>
                        <button @click="cancelarEdicao" class="rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </div>

              <p v-if="!painel?.leis_alteradoras?.length" class="text-sm text-gray-400 text-center py-8">
                Nenhum vínculo cadastrado para esta lei.
              </p>
            </div>
          </section>

          <section class="bg-white border border-gray-200 rounded-lg flex flex-col min-h-0 overflow-hidden">
            <header class="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Em consolidação</p>
              <h2 class="text-sm font-semibold text-green-800 mt-0.5">{{ labelLei(painel?.lei_alvo ?? leiAlvo) }}</h2>
            </header>

            <div class="border-b border-gray-200 p-3 bg-white">
              <div class="grid grid-cols-2 gap-2 mb-2">
                <button
                  @click="padronizarFormatacao"
                  :disabled="!!executando"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-45"
                >
                  Padronizar formatação
                </button>
                <button
                  @click="consolidacaoAutomatica"
                  :disabled="!!executando || !painel?.leis_alteradoras?.length"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-45"
                >
                  Consolidação automática
                </button>
                <button
                  @click="visualizarComAlteracoes"
                  :class="[
                    'rounded border px-2 py-1.5 text-xs font-medium',
                    visualizacao === 'marcacoes' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50',
                  ]"
                >
                  Lei com alterações
                </button>
                <button
                  @click="visualizarConsolidada"
                  :class="[
                    'rounded border px-2 py-1.5 text-xs font-medium',
                    visualizacao === 'consolidada' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50',
                  ]"
                >
                  Lei consolidada
                </button>
              </div>

              <button
                @click="publicar"
                :disabled="!!executando"
                class="w-full rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                {{ executando === 'publicar' ? 'Publicando...' : 'Publicar' }}
              </button>
            </div>

            <div class="grid grid-cols-3 border-b border-gray-200 text-center text-xs">
              <div class="py-2">
                <p class="font-semibold text-gray-900">{{ resumo.trechos_pendentes }}</p>
                <p class="text-gray-500">Pendentes</p>
              </div>
              <div class="py-2 border-x border-gray-200">
                <p class="font-semibold text-gray-900">{{ resumo.trechos_validados }}</p>
                <p class="text-gray-500">Validados</p>
              </div>
              <div class="py-2">
                <p class="font-semibold text-gray-900">{{ resumo.trechos_com_ajuste_manual }}</p>
                <p class="text-gray-500">Ajustes</p>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
              <article
                v-for="dispositivo in dispositivosConsolidacao"
                :key="`${visualizacao}-${dispositivo.referencia}`"
                :class="[
                  'rounded-md border bg-white px-3 py-2.5 text-sm',
                  dispositivo.afetado && visualizacao === 'marcacoes' ? 'border-amber-200' : 'border-gray-200',
                ]"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="font-semibold text-gray-900">{{ dispositivo.titulo }}</p>
                  <span v-if="dispositivo.afetado && visualizacao === 'marcacoes'" class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Em revisão
                  </span>
                </div>

                <div v-if="dispositivo.alteracoes?.length && visualizacao === 'marcacoes'" class="mt-2 space-y-2">
                  <div
                    v-for="trecho in dispositivo.alteracoes"
                    :key="trecho.id_trecho"
                    class="rounded border border-gray-200 bg-gray-50 p-2"
                  >
                    <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span :class="['rounded border px-1.5 py-0.5 text-[10px] font-semibold', classeTipo(trecho.tipo)]">
                        {{ labelTipo(trecho.tipo) }}
                      </span>
                      <span :class="['rounded border px-1.5 py-0.5 text-[10px] font-semibold', classeStatus(trecho.status_validacao)]">
                        {{ labelStatus(trecho.status_validacao) }}
                      </span>
                    </div>
                    <div
                      v-if="trecho.tipo === 'revogacao' && trecho.texto_original"
                      class="conteudo-html conteudo-html--compact text-red-700 line-through"
                      v-html="renderizarHtml(trecho.texto_original)"
                    ></div>
                    <div
                      v-else
                      class="conteudo-html conteudo-html--compact text-gray-700"
                      v-html="renderizarHtml(trecho.texto_aplicavel || trecho.texto_original)"
                    ></div>
                  </div>
                </div>

                <div v-else class="conteudo-html conteudo-html--compact mt-1 text-gray-600" v-html="renderizarHtml(dispositivo.texto)"></div>
              </article>

              <div v-if="visualizacao === 'consolidada' && !dispositivosConsolidacao.length && textoPreview" class="rounded-md border border-gray-200 bg-white p-3">
                <div class="conteudo-html text-gray-700" v-html="renderizarHtml(textoPreview)"></div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.conteudo-html {
  font-size: 0.75rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.conteudo-html--compact {
  max-height: 10.5rem;
  overflow: hidden;
}

.conteudo-html :deep(p) {
  margin: 0 0 0.35rem;
}

.conteudo-html :deep(p:last-child) {
  margin-bottom: 0;
}

.conteudo-html :deep(ul),
.conteudo-html :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.25rem;
}

.conteudo-html :deep(ul) {
  list-style: disc;
}

.conteudo-html :deep(ol) {
  list-style: decimal;
}

.conteudo-html :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.4rem 0;
}

.conteudo-html :deep(th),
.conteudo-html :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.25rem 0.4rem;
  vertical-align: top;
}
</style>
