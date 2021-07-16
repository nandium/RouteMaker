import axios from 'axios';
import { toastController, alertController } from '@ionic/vue';

const getAlertController = async (username: string, accessToken: string) => {
  const allowedReasons = ['', 'abusive', 'inappropriate', 'spam', 'racist', 'beliefs', 'notlike'];
  let reason = '';
  return await alertController.create({
    cssClass: 'wide',
    header: `Report ${username}?`,
    message: 'Select your reason for reporting below',
    inputs: [
      {
        type: 'radio',
        label: 'Abusive content',
        value: 'abusive',
        handler: (data) => (reason = data.value),
      },
      {
        type: 'radio',
        label: 'Inappropriate content',
        value: 'inappropriate',
        handler: (data) => (reason = data.value),
      },
      {
        type: 'radio',
        label: 'Spammer',
        value: 'spam',
        handler: (data) => (reason = data.value),
      },
      {
        type: 'radio',
        label: 'Racist content',
        value: 'racist',
        handler: (data) => (reason = data.value),
      },
      {
        type: 'radio',
        label: 'Content is against my beliefs',
        value: 'beliefs',
        handler: (data) => (reason = data.value),
      },
      {
        type: 'radio',
        label: "I don't like the content",
        value: 'notlike',
        handler: (data) => (reason = data.value),
      },
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
        cssClass: 'secondary',
      },
      {
        text: 'Ok',
        handler: () => {
          if (reason === '' || !allowedReasons.includes(reason)) {
            return false;
          }
          axios
            .post(
              process.env.VUE_APP_USER_ENDPOINT_URL + '/user/report',
              {
                name: username,
                reason,
              },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            )
            .then(() => {
              toastController
                .create({
                  header: 'Your report has been successfully sent',
                  position: 'bottom',
                  color: 'success',
                  duration: 3000,
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
            })
            .catch((error) => {
              console.error(error);
              toastController
                .create({
                  header: 'Failed to report user, please try again',
                  position: 'bottom',
                  color: 'danger',
                  duration: 3000,
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
            });
        },
      },
    ],
  });
};

export { getAlertController };
