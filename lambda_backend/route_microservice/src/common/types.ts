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
