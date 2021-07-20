import axios from 'axios';
import Providers from '@/providers';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 1, // Seconds
});
// Set as 1 second to reduce duplicate calls by vue
// Must be small or will be unresponsive to upvotes

const changeGradeUrl = process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/grade';

const changeRouteGrade = async (
  username: string,
  createdAt: string,
  grade: number,
): Promise<ResponseData> => {
  const headers = {
    Authorization: `Bearer ${Providers.getAccessToken().value}`,
  };
  const response = await axios.post(changeGradeUrl, { username, createdAt, grade }, { headers });
  return response.data as ResponseData;
};

// Caches in-memory, disappears on page refresh
const changeRouteGradeCached = async (
  username: string,
  createdAt: string,
  grade: number,
): Promise<ResponseData> => {
  // createdAt attribute only should be sufficient for 1 sec cache
  return memoryCache.wrap(createdAt, function () {
    return changeRouteGrade(username, createdAt, grade);
  });
};

interface ResponseData {
  Message: string;
  Item: {
    publicGrade: number;
    ownerGrade: number;
  };
}

export default changeRouteGradeCached;
