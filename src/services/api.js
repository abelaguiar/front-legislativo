import { token, limparSessao } from './auth.js'

const BASE_URL = '/api'

async function request(path, options = {}) {
  const headers = { 'Accept': 'application/json', ...options.headers }
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    limparSessao()
    window.location.href = '/login'
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `Erro ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function jsonRequest(path, method, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Laravel API Resources sempre envolvem recursos únicos em { "data": {...} }
// Esta função desembrulha o campo data quando presente
const unwrap = (res) => res?.data ?? res

export const api = {
  leis: {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request(`/leis${qs ? '?' + qs : ''}`)
    },
    mostrar: (id) => request(`/leis/${id}`).then(unwrap),
    criar: (dados) => jsonRequest('/leis', 'POST', dados).then(unwrap),
    atualizar: (id, dados) => jsonRequest(`/leis/${id}`, 'PUT', dados).then(unwrap),
    remover: (id) => request(`/leis/${id}`, { method: 'DELETE' }),
    versoes: (id) => request(`/leis/${id}/versoes`).then(res => res?.data ?? res),
    versao: (leiId, versaoId) => request(`/leis/${leiId}/versoes/${versaoId}`).then(unwrap),
    criarVersao: (leiId, dados) => jsonRequest(`/leis/${leiId}/versoes`, 'POST', dados).then(unwrap),
    atualizarVersao: (leiId, versaoId, dados) => jsonRequest(`/leis/${leiId}/versoes/${versaoId}`, 'PUT', dados).then(unwrap),
    painelConsolidacao: (leiId, versaoId) => request(`/leis/${leiId}/versoes/${versaoId}/consolidacao`).then(unwrap),
    analisarAlteradora: (leiId, versaoId, dados) => jsonRequest(`/leis/${leiId}/versoes/${versaoId}/analisar-alteradora`, 'POST', dados).then(unwrap),
    padronizarVersao: (leiId, versaoId, dados = {}) => jsonRequest(`/leis/${leiId}/versoes/${versaoId}/padronizar-formatacao`, 'POST', dados).then(unwrap),
    publicarVersao: (leiId, versaoId) => jsonRequest(`/leis/${leiId}/versoes/${versaoId}/publicar`, 'POST', {}).then(unwrap),
  },
  vinculos: {
    listar: (leiId) => request(`/leis/${leiId}/vinculos`).then(res => res?.data ?? res),
    criar: (leiId, dados) => jsonRequest(`/leis/${leiId}/vinculos`, 'POST', dados).then(unwrap),
    remover: (leiId, vinculoId) => request(`/leis/${leiId}/vinculos/${vinculoId}`, { method: 'DELETE' }),
    consolidar: (leiId, versaoId, dados) => jsonRequest(`/leis/${leiId}/versoes/${versaoId}/consolidar`, 'POST', dados).then(unwrap),
    atualizarTrecho: (leiId, vinculoId, trechoId, dados) => jsonRequest(`/leis/${leiId}/vinculos/${vinculoId}/trechos/${trechoId}`, 'PATCH', dados).then(unwrap),
  },
  anexos: {
    listar: (versaoId) => request(`/versoes/${versaoId}/anexos`).then(res => res?.data ?? res),
    upload: (versaoId, formData) => request(`/versoes/${versaoId}/anexos`, { method: 'POST', body: formData }).then(unwrap),
    remover: (versaoId, anexoId) => request(`/versoes/${versaoId}/anexos/${anexoId}`, { method: 'DELETE' }),
  },
  temas: {
    listar: () => request('/temas').then(res => res?.data ?? res),
  },
  auth: {
    login: (email, senha) => jsonRequest('/auth/login', 'POST', { email, senha }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
}
