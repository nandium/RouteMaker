import axios from 'axios';
import Providers from '@/providers';
import cacheManager from 'cache-manager';
import { GymRoute } from './getRoutesByGym';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 1, // Seconds
});

const getRoutesByUserUrl = process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/v1/route/user';

const getRoutesByUser = async (username: string): Promise<ResponseData> => {
  const headers = Providers.getLoggedIn().value
    ? { Authorization: `Bearer ${Providers.getAccessToken().value}` }
    : {};
  const response = await axios.get(getRoutesByUserUrl, {
    headers,
    params: { username },
  });
  return response.data as ResponseData;
};

// Caches in-memory, disappears on page refresh
const getRoutesByUserCached = async (username: string): Promise<ResponseData> => {
  return memoryCache.wrap(username, function () {
    return getRoutesByUser(username);
  });
};

interface ResponseData {
  Message: string;
  Items: UserRoute[];
}

interface UserRoute extends GymRoute {
  countryCode: string;
  gymName: string;
}

export default getRoutesByUserCached;
export { UserRoute };
