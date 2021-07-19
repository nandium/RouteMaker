import { Share } from '@capacitor/share';
import { RouteLocationNormalizedLoaded } from 'vue-router';

// Cannot use BASE_URL to get domain URL in native app
// TODO: If native platform, return fixed domain. If web, return BASE_URL
const DOMAIN = 'https://routemaker.rocks';

const shareSocial = async (vueRoute: RouteLocationNormalizedLoaded, message: string) => {
  return Share.share({
    title: 'Climb with me!',
    url: DOMAIN + vueRoute.path,
    text: message,
  });
};

export { shareSocial };
