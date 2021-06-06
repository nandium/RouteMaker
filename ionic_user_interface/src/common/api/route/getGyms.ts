import axios from 'axios';
import { routeBaseUrl } from './config';

const getGymsUrl = routeBaseUrl + '/route/gym/all';

/**
 *
 * @param {string} countryCode
 * @returns {Array} array of gyms
 */
const getGyms = async (countryCode: string): Promise<GymLocation[]> => {
  try {
    const {
      data: { Items },
    } = await axios.get(getGymsUrl, {
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

export default getGyms;
export { GymLocation };
