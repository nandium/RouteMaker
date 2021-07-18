import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import Explore from '@/views/Explore.vue';
import providers from '@/providers';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/explore',
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
    path: '/explore',
    name: 'Explore',
    component: Explore,
  },
  {
    path: '/new',
    name: 'New',
    component: () => import('@/views/New.vue'),
  },
  {
    path: '/help',
    name: 'Help',
    component: () => import('@/views/Help.vue'),
  },
  {
    path: '/gym/:gymLocation/:gymName',
    name: 'Gym',
    component: () => import('@/views/Explore.vue'),
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
        next('/explore');
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
        next('/explore');
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
        next('/explore');
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
        next('/explore');
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
        next('/explore');
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
          next('/explore');
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
    path: '/userRoutes/:username',
    name: 'UserRoutes',
    component: () => import('@/views/UserRoutes.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/explore',
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
