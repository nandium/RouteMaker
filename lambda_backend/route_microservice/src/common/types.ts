interface AuthHeader {
  headers: {
    Authorization: string;
  };
}

export interface GetAllGymsEvent {
  queryStringParameters: {
    countryCode: string;
  };
}

export interface CreateRouteEvent extends AuthHeader {
  body: {
    countryCode: string;
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

export type ReportRouteEvent = UpVoteRouteEvent;

export interface GradeRouteEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
    grade: number;
  };
}

export interface AddCommentEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
    comment: string;
  };
}

export interface DeleteCommentEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
    timestamp: number;
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

interface GradeSubmission {
  username: string;
  grade: number;
}

export interface Comment {
  username: string;
  timestamp: number;
  comment: string;
}

export interface RouteItem {
  username: string;
  createdAt: string;
  ttl: number;
  routeName: string;
  gymLocation: string;
  routeURL: string;
  ownerGrade: number;
  publicGrade: number;
  publicGradeSubmissions: Array<GradeSubmission>;
  voteCount: number;
  upVotes: Array<string>;
  reports: Array<string>;
  commentCount: number;
  comments: Array<Comment>;
}
