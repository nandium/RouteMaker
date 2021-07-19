import axios from 'axios';
import { routeBaseUrl } from './config';
import Providers from '@/providers';
import cacheManager from 'cache-manager';

const memoryCache = cacheManager.caching({
  store: 'memory',
  max: 10, // Number of items in cache
  ttl: 1, // Seconds
});
// Set as 1 second to reduce duplicate calls by vue
// Must be small or will be unresponsive to upvotes

const getRoutesByGymUrl = routeBaseUrl + '/route/all';

const getRoutesByGym = async (gymLocation: string): Promise<ResponseData> => {
  const headers = Providers.getLoggedIn().value
    ? { Authorization: `Bearer ${Providers.getAccessToken().value}` }
    : {};
  const response = await axios.get(getRoutesByGymUrl, {
    headers,
    params: { gymLocation },
  });
  return response.data as ResponseData;
};

// Caches in-memory, disappears on page refresh
const getRoutesByGymCached = async (gymLocation: string): Promise<ResponseData> => {
  return memoryCache.wrap(gymLocation, function () {
    return getRoutesByGym(gymLocation);
  });
};

interface ResponseData {
  Message: string;
  Items: GymRoute[];
}

interface GymRoute {
  commentCount: number;
  createdAt: string;
  gymLocation: string;
  publicGrade: number;
  routeName: string;
  username: string;
  voteCount: number;
  hasVoted: boolean;
  routeId: number;
}

export default getRoutesByGymCached;
export { GymRoute };
