const BASE_URL = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `Erro ${res.status}`)
  }
  return res.json()
}

export const api = {
  leis: {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request(`/leis${qs ? '?' + qs : ''}`)
    },
    mostrar: (id) => request(`/leis/${id}`),
    versoes: (id) => request(`/leis/${id}/versoes`),
    versao: (leiId, versaoId) => request(`/leis/${leiId}/versoes/${versaoId}`),
  },
}
