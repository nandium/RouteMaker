import axios from 'axios';
import { routeBaseUrl } from './config';
import Providers from '@/providers';

const requestGymUrl = routeBaseUrl + '/route/gym/request';

const requestGym = async (countryCode: string, postal: string, gymName: string): Promise<void> => {
  const config = {
    headers: {
      Authorization: `Bearer ${Providers.getAccessToken().value}`,
    },
  };
  try {
    await axios.post(
      requestGymUrl,
      {
        countryCode,
        postal,
        gymName,
      },
      config,
    );
  } catch (error) {
    console.error(error.response.data);
    throw error;
  }
};

export default requestGym;
