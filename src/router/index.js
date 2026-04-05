import { createRouter, createWebHistory } from 'vue-router'
import ListaLeis from '../views/ListaLeis.vue'
import DetalheLei from '../views/DetalheLei.vue'

const routes = [
  { path: '/', name: 'lista-leis', component: ListaLeis },
  { path: '/leis/:id', name: 'detalhe-lei', component: DetalheLei },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
