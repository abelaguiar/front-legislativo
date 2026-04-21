import { ref, computed } from 'vue'

const TOKEN_KEY = 'legislativo_token'
const USER_KEY  = 'legislativo_user'

export const token = ref(localStorage.getItem(TOKEN_KEY) ?? null)
export const usuario = ref(JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'))

export const autenticado = computed(() => !!token.value)

export function salvarSessao(t, u) {
  token.value = t
  usuario.value = u
  localStorage.setItem(TOKEN_KEY, t)
  localStorage.setItem(USER_KEY, JSON.stringify(u))
}

export function limparSessao() {
  token.value = null
  usuario.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
