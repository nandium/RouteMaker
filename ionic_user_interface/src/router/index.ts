import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import Home from '@/views/Home.vue';

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
      if (localStorage.getItem('isLoggedIn') === 'yes') {
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
      if (localStorage.getItem('isLoggedIn') === 'yes') {
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
      if (localStorage.getItem('isLoggedIn') === 'yes') {
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
      if (localStorage.getItem('isLoggedIn') === 'yes') {
        next('/home');
      } else if (localStorage.getItem('username') === null) {
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
      if (localStorage.getItem('isLoggedIn') === 'yes') {
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
      if (
        localStorage.getItem('isLoggedIn') === 'yes' ||
        localStorage.getItem('isConfirmationNeeded') !== 'yes'
      ) {
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
      if (localStorage.getItem('isLoggedIn') !== 'yes') {
        next('/home');
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
