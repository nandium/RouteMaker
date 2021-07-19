import axios from 'axios';
import { routeBaseUrl } from './config';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 10, // Seconds
});

const getGymsByCountryUrl = routeBaseUrl + '/route/gym/country';

const getGymsByCountry = async (countryCode: string): Promise<GymLocation[]> => {
  try {
    const {
      data: { Items },
    } = await axios.get(getGymsByCountryUrl, {
      params: { countryCode },
    });
    return Items;
  } catch (error) {
    console.error(error.response.data);
  }
  return [];
};

const getGymsByCountryCached = async (countryCode: string): Promise<GymLocation[]> => {
  return memoryCache.wrap(countryCode, function () {
    return getGymsByCountry(countryCode);
  });
};

interface GymLocation {
  countryCode: string;
  gymLocation: string;
  gymName: string;
}

export default getGymsByCountryCached;
export { GymLocation };
