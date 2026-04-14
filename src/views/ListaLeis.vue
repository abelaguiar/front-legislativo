<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'

const router = useRouter()

const leis = ref([])
const meta = ref(null)
const loading = ref(false)
const erro = ref(null)

const busca = ref('')
const ano = ref(null)
const mes = ref(null)
const dia = ref(null)
const numero = ref(null)
const pagina = ref(1)

let debounceTimer = null

async function carregar() {
  loading.value = true
  erro.value = null
  try {
    const params = { page: pagina.value }
    if (busca.value.trim()) params['filter[busca]'] = busca.value.trim()
    if (numero.value !== null && numero.value !== '') params['filter[numero]'] = numero.value
    if (ano.value !== null && ano.value !== '') params['filter[ano]'] = ano.value
    if (mes.value !== null && mes.value !== '') params['filter[mes]'] = mes.value
    if (dia.value !== null && dia.value !== '') params['filter[dia]'] = dia.value
    const data = await api.leis.listar(params)
    leis.value = data.data
    meta.value = data.meta ?? null
  } catch (e) {
    erro.value = e.message
  } finally {
    loading.value = false
  }
}

function agendarBusca() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagina.value = 1
    carregar()
  }, 500)
}

watch([busca, numero, ano, mes, dia], agendarBusca)

watch(pagina, carregar)

onMounted(carregar)

function irParaLei(id) {
  router.push({ name: 'detalhe-lei', params: { id } })
}

function formatarData(data) {
  if (!data) return '—'
  const [y, m, d] = data.split('-')
  return `${d}/${m}/${y}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-green-800 text-white shadow">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wide">Assembleia Legislativa — Ceará</h1>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-8">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Legislação Estadual</h2>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 mb-6">
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model="busca"
            type="search"
            placeholder="Buscar por ementa..."
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <input
            v-model.number="numero"
            type="number"
            placeholder="Nº da lei"
            class="w-36 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model.number="dia"
            type="number"
            placeholder="Dia"
            class="w-28 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <input
            v-model.number="mes"
            type="number"
            placeholder="Mês"
            class="w-28 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <input
            v-model.number="ano"
            type="number"
            placeholder="Ano (ex: 2024)"
            class="w-40 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>

      <!-- Estado de carregamento/erro -->
      <div v-if="loading" class="flex justify-center py-16">
        <svg class="w-8 h-8 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>

      <div v-else-if="erro" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
        {{ erro }}
      </div>

      <div v-else-if="leis.length === 0" class="text-center py-16 text-gray-400 text-sm">
        Nenhuma lei encontrada.
      </div>

      <!-- Lista -->
      <div v-else class="space-y-3">
        <button
          v-for="lei in leis"
          :key="lei.id_lei"
          @click="irParaLei(lei.id_lei)"
          class="w-full text-left bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md hover:border-green-400 transition-all group"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {{ lei.tipo_lei?.sigla ?? 'LEI' }}
                </span>
                <span class="text-xs text-gray-400">Nº {{ lei.numero }}/{{ lei.ano }}</span>
              </div>
              <p class="text-sm text-gray-700 line-clamp-2 leading-snug">
                {{ lei.versao_atual?.ementa ?? '—' }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-gray-400 whitespace-nowrap">
                {{ formatarData(lei.versao_atual?.data_publicacao) }}
              </p>
              <svg class="w-4 h-4 text-gray-300 group-hover:text-green-600 mt-2 ml-auto transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </button>
      </div>

      <!-- Paginação -->
      <div v-if="meta && meta.last_page > 1" class="flex items-center justify-center gap-2 mt-8">
        <button
          :disabled="pagina <= 1"
          @click="pagina--"
          class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition"
        >
          ← Anterior
        </button>
        <span class="text-sm text-gray-500">{{ pagina }} / {{ meta.last_page }}</span>
        <button
          :disabled="pagina >= meta.last_page"
          @click="pagina++"
          class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition"
        >
          Próxima →
        </button>
      </div>
    </main>
  </div>
</template>
