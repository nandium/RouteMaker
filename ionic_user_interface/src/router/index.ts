import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import Home from '@/views/Home.vue';
import providers from '@/providers';

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
  {
    path: '/gyms/request',
    name: 'RequestGym',
    component: () => import('@/views/RequestGym.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next();
      } else {
        next('/login');
      }
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next('/home');
      } else {
        next();
      }
    },
  },
  {
    path: '/forgotPassword',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next('/home');
      } else {
        next();
      }
    },
  },
  {
    path: '/resetPassword',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPassword.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next('/home');
      } else if (providers.getUsername().value === '') {
        next('/forgotPassword');
      } else {
        next();
      }
    },
  },
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('@/views/Signup.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next('/home');
      } else {
        next();
      }
    },
  },
  {
    path: '/confirm',
    name: 'Confirm',
    component: () => import('@/views/Confirm.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value || !providers.getConfirmationNeeded().value) {
        next('/home');
      } else {
        next();
      }
    },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        next();
      } else {
        next('/login');
      }
    },
  },
  {
    path: '/uploadRoute',
    name: 'UploadRoute',
    component: () => import('@/views/UploadRoute.vue'),
    beforeEnter: (_, __, next) => {
      if (providers.getLoggedIn().value) {
        if (providers.getRouteImageUri().value !== '') {
          next();
        } else {
          next('/home');
        }
      } else {
        next('/login');
      }
    },
  },
  {
    path: '/viewRoute/:username/:createdAt',
    name: 'ViewRoute',
    component: () => import('@/views/ViewRoute.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
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
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
