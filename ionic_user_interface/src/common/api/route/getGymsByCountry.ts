import axios from 'axios';
import { routeBaseUrl } from './config';

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

interface GymLocation {
  countryCode: string;
  gymLocation: string;
  gymName: string;
}

export default getGymsByCountry;
export { GymLocation };
