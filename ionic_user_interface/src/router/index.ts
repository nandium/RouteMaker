import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import Home from '../views/Home.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
    beforeEnter: (_, __, next) => {
      // Refer to /public/404.html
      if (sessionStorage.getItem('redirect') !== null) {
        const redirect = sessionStorage.redirect;
        delete sessionStorage.redirect;
        next(redirect);
      } else {
        next();
      }
    },
  },
  {
    path: '/home',
    name: 'Home',
    component: Home,
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
  },
  {
    path: '/gyms',
    name: 'Gyms',
    component: () => import('@/views/Gyms.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
