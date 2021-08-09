import axios from 'axios';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 1, // Number of items in cache
  ttl: 180, // Seconds
});

const getReverseGeoLocationCached = async (lngLatString: string): Promise<ResponseData> => {
  return memoryCache.wrap(lngLatString, function () {
    return axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLatString}.json?types=country&access_token=${process.env.VUE_APP_MAPBOX_ACCESS_KEY}`,
    );
  });
};

interface ResponseData {
  data: {
    features: Array<{
      place_name: string;
    }>;
  };
}

export default getReverseGeoLocationCached;
