import axios from 'axios';
import Providers from '@/providers';
import { Comment } from './getRouteDetails';

const addCommentUrl = process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/comment';

const addCommentToRoute = async (
  username: string,
  createdAt: string,
  comment: string,
): Promise<ResponseData> => {
  const headers = {
    Authorization: `Bearer ${Providers.getAccessToken().value}`,
  };
  const response = await axios.post(addCommentUrl, { username, createdAt, comment }, { headers });
  return response.data as ResponseData;
};

interface ResponseData {
  Message: string;
  Item: Comment;
}

export default addCommentToRoute;
