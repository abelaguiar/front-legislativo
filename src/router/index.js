import { createRouter, createWebHistory } from 'vue-router'
import { autenticado } from '../services/auth.js'
import ListaLeis from '../views/ListaLeis.vue'
import DetalheLei from '../views/DetalheLei.vue'
import CadastroLei from '../views/CadastroLei.vue'
import EdicaoLei from '../views/EdicaoLei.vue'
import Login from '../views/Login.vue'

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { publica: true } },
  { path: '/', name: 'lista-leis', component: ListaLeis },
  { path: '/leis/novo', name: 'cadastro-lei', component: CadastroLei },
  { path: '/leis/:id/editar', name: 'edicao-lei', component: EdicaoLei },
  { path: '/leis/:id', name: 'detalhe-lei', component: DetalheLei },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (!to.meta.publica && !autenticado.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && autenticado.value) {
    return { name: 'lista-leis' }
  }
})

export default router
