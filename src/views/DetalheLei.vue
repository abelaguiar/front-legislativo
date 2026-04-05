<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../services/api.js'

const route = useRoute()
const router = useRouter()

const lei = ref(null)
const versoes = ref([])
const versaoSelecionadaId = ref(null)
const loading = ref(false)
const erro = ref(null)

const versaoAtual = computed(() =>
  versoes.value.find(v => v.id_versao_lei === versaoSelecionadaId.value) ?? null
)

async function carregar() {
  loading.value = true
  erro.value = null
  try {
    const [leiData, versData] = await Promise.all([
      api.leis.mostrar(route.params.id),
      api.leis.versoes(route.params.id),
    ])
    lei.value = leiData.data
    versoes.value = versData.data ?? versData
    const atual = versoes.value.find(v => v.versao_atual)
    versaoSelecionadaId.value = atual?.id_versao_lei ?? versoes.value[0]?.id_versao_lei ?? null
  } catch (e) {
    erro.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(carregar)

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
        <button @click="router.back()" class="hover:bg-green-700 rounded p-1 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-xl font-bold tracking-wide">Assembleia Legislativa — Ceará</h1>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-8">

      <!-- Carregando -->
      <div v-if="loading" class="flex justify-center py-24">
        <svg class="w-8 h-8 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>

      <!-- Erro -->
      <div v-else-if="erro" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
        {{ erro }}
      </div>

      <template v-else-if="lei">
        <!-- Cabeçalho da lei -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 mb-6">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              {{ lei.tipo_lei?.sigla ?? 'LEI' }}
            </span>
            <span class="text-xs text-gray-400">{{ lei.tipo_lei?.nome }}</span>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-1">
            Nº {{ lei.numero }}/{{ lei.ano }}
          </h2>
          <p class="text-sm text-gray-600 leading-relaxed">
            {{ lei.versao_atual?.ementa ?? '—' }}
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <!-- Sidebar: seletor de versões -->
          <aside class="lg:col-span-1">
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Versões</h3>
              <ul class="space-y-1">
                <li v-for="v in versoes" :key="v.id_versao_lei">
                  <button
                    @click="versaoSelecionadaId = v.id_versao_lei"
                    :class="[
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition',
                      versaoSelecionadaId === v.id_versao_lei
                        ? 'bg-green-700 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    ]"
                  >
                    <span class="block">Versão {{ v.numero_versao }}</span>
                    <span :class="['block text-xs mt-0.5', versaoSelecionadaId === v.id_versao_lei ? 'text-green-200' : 'text-gray-400']">
                      {{ formatarData(v.data_publicacao) }}
                    </span>
                    <span
                      v-if="v.versao_atual"
                      :class="['text-xs font-semibold', versaoSelecionadaId === v.id_versao_lei ? 'text-green-200' : 'text-green-700']"
                    >
                      atual
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </aside>

          <!-- Conteúdo da versão selecionada -->
          <section class="lg:col-span-3" v-if="versaoAtual">
            <!-- Metadados -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 mb-4">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p class="text-xs text-gray-400 mb-0.5">Versão</p>
                  <p class="font-medium text-gray-700">{{ versaoAtual.numero_versao }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-400 mb-0.5">Data de publicação</p>
                  <p class="font-medium text-gray-700">{{ formatarData(versaoAtual.data_publicacao) }}</p>
                </div>
                <div v-if="versaoAtual.notas_revisao">
                  <p class="text-xs text-gray-400 mb-0.5">Notas de revisão</p>
                  <p class="font-medium text-gray-700">{{ versaoAtual.notas_revisao }}</p>
                </div>
              </div>
            </div>

            <!-- Links externos -->
            <div v-if="versaoAtual.links?.length" class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 mb-4">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Links</h3>
              <ul class="space-y-1">
                <li v-for="link in versaoAtual.links" :key="link.id_link_lei">
                  <a :href="link.url" target="_blank" rel="noopener noreferrer"
                    class="text-sm text-green-700 hover:underline flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    {{ link.descricao ?? link.url }}
                  </a>
                </li>
              </ul>
            </div>

            <!-- Texto integral -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Texto Integral</h3>
              <div
                v-if="versaoAtual.texto_integral"
                class="prose prose-sm max-w-none text-gray-800"
                v-html="versaoAtual.texto_integral"
              />
              <p v-else class="text-sm text-gray-400 italic">Texto integral não disponível para esta versão.</p>
            </div>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.prose :deep(h3) {
  @apply text-base font-bold text-gray-900 mt-5 mb-1;
}
.prose :deep(p) {
  @apply text-sm leading-relaxed text-gray-700 mb-2;
}
.prose :deep(strong) {
  @apply font-semibold text-gray-900;
}
</style>
