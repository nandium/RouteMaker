import { ref, Ref } from 'vue';
import axios from 'axios';
import router from '@/router';

const isLoggedIn = ref(false);
const userEmail = ref('');
const accessToken = ref('');
const idToken = ref('');
const isConfirmationNeeded = ref(false);

const providers = {
  forceLogout: async (): Promise<void> => {
    const config = {
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
      },
    };
    console.log(config);
    return axios
      .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/logout', {}, config)
      .then((response) => {
        if (response.status === 200) {
          isLoggedIn.value = false;
          userEmail.value = '';
          accessToken.value = '';
          idToken.value = '';
          isConfirmationNeeded.value = false;
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('idToken');
          localStorage.removeItem('isConfirmationNeeded');
          router.push('/home');
        }
      })
      .catch((error) => {
        console.error(error);
      });
  },
  getLoggedIn: (): Ref<boolean> => {
    isLoggedIn.value = localStorage.getItem('isLoggedIn') === 'yes';
    return isLoggedIn;
  },
  setLoggedIn: (loggedIn: boolean): void => {
    localStorage.setItem('isLoggedIn', loggedIn ? 'yes' : 'no');
    isLoggedIn.value = loggedIn;
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
  getConformationNeeded: (): Ref<boolean> => {
    isConfirmationNeeded.value = localStorage.getItem('isConfirmationNeeded') === 'yes';
    return isConfirmationNeeded;
  },
  setConfirmationNeeded: (confirmationNeeded: boolean): void => {
    isConfirmationNeeded.value = confirmationNeeded;
    localStorage.setItem('isConfirmationNeeded', confirmationNeeded ? 'yes' : 'no');
  },
};

export default providers;
