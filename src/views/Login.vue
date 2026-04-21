<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'
import { salvarSessao } from '../services/auth.js'

const router = useRouter()

const email = ref('')
const senha = ref('')
const carregando = ref(false)
const erro = ref(null)
const mostrarSenha = ref(false)

async function entrar() {
  if (!email.value || !senha.value) {
    erro.value = 'Preencha o e-mail e a senha.'
    return
  }
  carregando.value = true
  erro.value = null
  try {
    const res = await api.auth.login(email.value, senha.value)
    salvarSessao(res.token, res.usuario)
    router.push({ name: 'lista-leis' })
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <!-- Logo / Header -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-900 mb-4 shadow-lg">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-gray-900">Assembleia Legislativa</h1>
        <p class="text-sm text-gray-500 mt-1">Sistema de Gestão Legislativa — Ceará</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-5">Entrar na conta</h2>

        <!-- Erro -->
        <div v-if="erro" class="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          {{ erro }}
        </div>

        <form @submit.prevent="entrar" class="space-y-4">
          <!-- E-mail -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              E-mail
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="seu@email.gov.br"
              autocomplete="email"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
            />
          </div>

          <!-- Senha -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Senha
            </label>
            <div class="relative">
              <input
                v-model="senha"
                :type="mostrarSenha ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition pr-10"
              />
              <button
                type="button"
                @click="mostrarSenha = !mostrarSenha"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                <svg v-if="!mostrarSenha" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Botão -->
          <button
            type="submit"
            :disabled="carregando"
            class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-green-800 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition mt-2"
          >
            <svg v-if="carregando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {{ carregando ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        Sistema restrito ao uso institucional
      </p>
    </div>
  </div>
</template>
