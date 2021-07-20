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

const getRouteDetailsUrl = process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details';

const getRouteDetails = async (username: string, createdAt: string): Promise<ResponseData> => {
  const headers = Providers.getLoggedIn().value
    ? { Authorization: `Bearer ${Providers.getAccessToken().value}` }
    : {};
  const response = await axios.post(getRouteDetailsUrl, { username, createdAt }, { headers });
  return response.data as ResponseData;
};

// Caches in-memory, disappears on page refresh
const getRoutesDetailsCached = async (
  username: string,
  createdAt: string,
): Promise<ResponseData> => {
  // createdAt attribute only should be sufficient for 1 sec cache
  return memoryCache.wrap(createdAt, function () {
    return getRouteDetails(username, createdAt);
  });
};

interface ResponseData {
  Message: string;
  Item: RouteDetails;
}

interface Comment {
  username: string;
  timestamp: number;
  comment: string;
}

interface RouteDetails {
  comments: Comment[];
  countryCode: string;
  createdAt: string;
  expiredTime: string;
  graded: number;
  gymLocation: string;
  hasGraded: boolean;
  hasReported: boolean;
  hasVoted: boolean;
  ownerGrade: number;
  publicGrade: number;
  routeName: string;
  routeURL: string;
  username: string;
  voteCount: number;
}

export default getRoutesDetailsCached;
export { RouteDetails, Comment };
