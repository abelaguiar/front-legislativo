<script setup>
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'
import { usuario, limparSessao } from '../services/auth.js'

const props = defineProps({
  showBack: { type: Boolean, default: false },
})

const router = useRouter()

async function logout() {
  try { await api.auth.logout() } catch {}
  limparSessao()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="bg-green-900 text-white shadow">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
      <button
        v-if="showBack"
        @click="router.back()"
        class="hover:bg-green-700 rounded p-1 transition"
        title="Voltar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
      </svg>

      <h1 class="text-lg font-semibold tracking-wide">Assembleia Legislativa — Ceará</h1>

      <nav class="ml-8 flex items-center gap-1">
        <RouterLink
          :to="{ name: 'lista-leis' }"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white hover:bg-green-700 transition"
          active-class="bg-green-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Leis
        </RouterLink>
        <RouterLink
          :to="{ name: 'consolidacao-lei' }"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white hover:bg-green-700 transition"
          active-class="bg-green-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8M8 12h8M8 17h4M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"/>
          </svg>
          Consolidação
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <span v-if="usuario" class="text-sm text-green-300">{{ usuario.nome }}</span>
        <button @click="logout" class="flex items-center gap-1.5 text-sm text-green-300 hover:text-white transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </div>
  </header>
</template>
