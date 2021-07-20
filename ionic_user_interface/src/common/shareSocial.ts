import { CapacitorException } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { toastController } from '@ionic/vue';
import { RouteLocationNormalizedLoaded } from 'vue-router';

// Cannot use BASE_URL to get domain URL in native app
// TODO: If native platform, return fixed domain. If web, return BASE_URL
const DOMAIN = 'https://routemaker.rocks';

const shareSocial = async (
  vueRoute: RouteLocationNormalizedLoaded,
  message: string,
): Promise<void> => {
  try {
    await Share.share({
      title: 'Climb with me!',
      url: DOMAIN + vueRoute.path,
      text: message,
    });
  } catch (error) {
    // Copy to clipboard as fallback
    if (error instanceof CapacitorException) {
      navigator.clipboard.writeText(DOMAIN + vueRoute.path);
      toastController
        .create({
          header: 'Copied URL to clipboard!',
          position: 'bottom',
          color: 'medium',
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
    } else {
      throw error;
    }
  }
};

export { shareSocial };
