import axios from 'axios';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 30, // Seconds
});

const getGymsByCountryUrl = process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/v1/route/gym/country';

const getGymsByCountry = async (countryCode: string): Promise<GymLocation[]> => {
  try {
    const {
      data: { Items },
    } = await axios.get(getGymsByCountryUrl, {
      params: { countryCode },
    });
    // Sort alphabetically by gym name
    (Items as GymLocation[]).sort((a, b) => (a.gymName > b.gymName ? 1 : -1));
    return Items;
  } catch (error) {
    console.error(error.response.data);
  }
  return [];
};

// Caches in-memory, disappears on page refresh
const getGymsByCountryCached = async (countryCode: string): Promise<GymLocation[]> => {
  return memoryCache.wrap('country_' + countryCode, function () {
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
