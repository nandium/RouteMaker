import { computed, ComputedRef, ref, Ref } from 'vue';
import axios from 'axios';
import router from '@/router';
import jwt_decode from 'jwt-decode';
import { toastController } from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';

const isLoggedIn = ref(false);
const username = ref('');
const userEmail = ref('');
const accessToken = ref('');
const refreshToken = ref('');
const idToken = ref('');
const isConfirmationNeeded = ref(false);
const prefersDarkMode = ref(false);
const routeImageUri = ref('');
const userCountry: Ref<Country | null> = ref(Lookup.byIso('SGP'));
const userRole = computed(() => {
  try {
    const idObject: { 'custom:role': string } = jwt_decode(providers.getIdToken().value);
    return idObject['custom:role'];
  } catch (error) {
    return 'undefined';
  }
});

const forceLogout = async (): Promise<void> => {
  const config = {
    headers: {
      Authorization: `Bearer ${providers.getAccessToken().value}`,
    },
  };
  return axios
    .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/logout', {}, config)
    .then((response) => {
      console.log(response.data.Message);
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
      refreshToken.value = '';
      idToken.value = '';
      isConfirmationNeeded.value = false;
      routeImageUri.value = '';
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('isConfirmationNeeded');
      localStorage.removeItem('routeImageUri');
      router.push({ name: 'Explore' });
    });
};

const checkExpiry = async (): Promise<void> => {
  if (providers.getLoggedIn().value && providers.getAccessToken().value !== '') {
    let expired = false;
    try {
      const token: { exp: number } = jwt_decode(providers.getAccessToken().value);
      // Expired AccessToken is refreshed
      if (token.exp <= Math.floor(Date.now() / 1000)) {
        const response = await axios.post(
          process.env.VUE_APP_USER_ENDPOINT_URL + '/user/refreshToken',
          {
            refreshToken: providers.getRefreshToken().value,
          },
        );
        providers.setAccessToken(response.data.AccessToken);
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
  getRefreshToken: (): Ref<string> => {
    refreshToken.value = localStorage.getItem('refreshToken') ?? '';
    return refreshToken;
  },
  setRefreshToken: (token: string): void => {
    localStorage.setItem('refreshToken', token);
    refreshToken.value = token;
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
  getRouteImageUri: (): Ref<string> => {
    routeImageUri.value = localStorage.getItem('routeImageUri') ?? '';
    return routeImageUri;
  },
  setRouteImageUri: (imageUri: string): void => {
    localStorage.setItem('routeImageUri', imageUri);
    routeImageUri.value = imageUri;
  },
  getUserCountry: (): Ref<Country | null> => {
    try {
      userCountry.value = JSON.parse(
        localStorage.getItem('userCountry') ?? JSON.stringify(Lookup.byIso('SGP')),
      );
      return userCountry;
    } catch {
      return ref(Lookup.byIso('SGP'));
    }
  },
  setUserCountry: (country: Country): void => {
    localStorage.setItem('userCountry', JSON.stringify(country));
    userCountry.value = country;
  },
  getUserRole: (): ComputedRef<string> => {
    return userRole;
  },
};

export default providers;
