interface AuthHeader {
  headers: {
    Authorization: string;
  };
}

export interface GetAllGymsEvent {
  queryStringParameters: {
    country: string;
  };
}

export interface CreateRouteEvent extends AuthHeader {
  body: {
    country: string;
    routeName: string;
    expiredTime: string;
    gymLocation: string;
    ownerGrade: number;
    routePhoto: {
      filename: string;
      mimetype: string;
      content: Buffer;
    };
  };
}

export interface DeleteRouteEvent extends AuthHeader {
  body: {
    createdAt: string;
  };
}

export interface GetRoutesByGymEvent {
  queryStringParameters: {
    gymLocation: string;
  };
}

export interface GetRouteDetailsEvent {
  headers: {
    Authorization?: string;
  };
  body: {
    username: string;
    createdAt: string;
  };
}

export interface UpVoteRouteEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
  };
}

export interface JwtPayload {
  sub: string;
  event_id: string;
  token_use: string;
  scope: 'aws.cognito.signin.user.admin';
  auth_time: number;
  iss: string;
  exp: number;
  iat: number;
  jti: string;
  client_id: string;
  username: string;
}
