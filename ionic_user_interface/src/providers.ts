import { ref, Ref } from 'vue';
import axios from 'axios';
import router from '@/router';
import jwt_decode from 'jwt-decode';
import { toastController } from '@ionic/vue';

const isLoggedIn = ref(false);
const username = ref('');
const userEmail = ref('');
const accessToken = ref('');
const idToken = ref('');
const isConfirmationNeeded = ref(false);
const prefersDarkMode = ref(false);

const forceLogout = async (): Promise<void> => {
  const config = {
    headers: {
      Authorization: `Bearer ${accessToken.value}`,
    },
  };
  return axios
    .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/logout', {}, config)
    .then((response) => {
      console.log(response.data);
    })
    .catch((error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.error(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error', error.message);
      }
    })
    .finally(() => {
      isLoggedIn.value = false;
      username.value = '';
      userEmail.value = '';
      accessToken.value = '';
      idToken.value = '';
      isConfirmationNeeded.value = false;
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('isConfirmationNeeded');
      router.push('/home');
    });
};

const checkExpiry = async (): Promise<void> => {
  if (isLoggedIn.value && accessToken.value !== '') {
    let expired = false;
    try {
      const token: { exp: number } = jwt_decode(accessToken.value);
      if (token.exp <= Math.floor(Date.now() / 1000)) {
        await forceLogout();
        expired = true;
      }
    } catch (error) {
      console.error(error);
      await forceLogout();
      expired = true;
    }
    if (expired) {
      toastController
        .create({
          header: 'Logged out due to session expiry. Please login again!',
          position: 'bottom',
          color: 'danger',
          buttons: [
            {
              text: 'Close',
              role: 'cancel',
            },
          ],
        })
        .then((toast) => {
          toast.present();
        });
    }
  }
};

const providers = {
  checkExpiry,
  forceLogout,
  getLoggedIn: (): Ref<boolean> => {
    isLoggedIn.value = localStorage.getItem('isLoggedIn') === 'yes';
    return isLoggedIn;
  },
  setLoggedIn: (loggedIn: boolean): void => {
    localStorage.setItem('isLoggedIn', loggedIn ? 'yes' : 'no');
    isLoggedIn.value = loggedIn;
  },
  getUsername: (): Ref<string> => {
    username.value = localStorage.getItem('username') ?? '';
    return username;
  },
  setUsername: (name: string): void => {
    localStorage.setItem('username', name);
    username.value = name;
  },
  getUserEmail: (): Ref<string> => {
    userEmail.value = localStorage.getItem('userEmail') ?? '';
    return userEmail;
  },
  setUserEmail: (email: string): void => {
    localStorage.setItem('userEmail', email);
    userEmail.value = email;
  },
  getAccessToken: (): Ref<string> => {
    accessToken.value = localStorage.getItem('accessToken') ?? '';
    return accessToken;
  },
  setAccessToken: (token: string): void => {
    localStorage.setItem('accessToken', token);
    accessToken.value = token;
  },
  getIdToken: (): Ref<string> => {
    idToken.value = localStorage.getItem('idToken') ?? '';
    return idToken;
  },
  setIdToken: (token: string): void => {
    localStorage.setItem('idToken', token);
    idToken.value = token;
  },
  getConfirmationNeeded: (): Ref<boolean> => {
    isConfirmationNeeded.value = localStorage.getItem('isConfirmationNeeded') === 'yes';
    return isConfirmationNeeded;
  },
  setConfirmationNeeded: (confirmationNeeded: boolean): void => {
    isConfirmationNeeded.value = confirmationNeeded;
    localStorage.setItem('isConfirmationNeeded', confirmationNeeded ? 'yes' : 'no');
  },
  getPrefersDarkMode: (): Ref<boolean> => {
    // If user has not overrided using the dark mode toggle under /profile, we try and set it according to his @media properties
    if (
      localStorage.getItem('prefersDarkMode') !== 'no' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      localStorage.setItem('prefersDarkMode', 'yes');
    }
    if (localStorage.getItem('prefersDarkMode') === 'yes') {
      prefersDarkMode.value = true;
    } else {
      prefersDarkMode.value = false;
    }
    return prefersDarkMode;
  },
  setPrefersDarkMode: (darkMode: boolean): void => {
    prefersDarkMode.value = darkMode;
    localStorage.setItem('prefersDarkMode', darkMode ? 'yes' : 'no');
  },
};

export default providers;
