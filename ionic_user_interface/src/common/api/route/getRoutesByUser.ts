import axios from 'axios';
import { routeBaseUrl } from './config';
import Providers from '@/providers';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 1, // Seconds
});

const getRoutesByUserUrl = routeBaseUrl + '/route/user';

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

interface UserRoute {
  commentCount: number;
  createdAt: string;
  gymLocation: string;
  publicGrade: number;
  routeName: string;
  username: string;
  voteCount: number;
  hasVoted: boolean;
  countryCode: string;
  gymName: string;
}

export default getRoutesByUserCached;
export { UserRoute };
