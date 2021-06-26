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
  queryStringParameters: {
    username: string;
    createdAt: string;
  };
}

export interface GetRoutesByGymEvent {
  queryStringParameters: {
    gymLocation: string;
  };
}

export interface GetRoutesByUserEvent {
  queryStringParameters: {
    username: string;
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

export interface UpvoteRouteEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
  };
}

export type ReportRouteEvent = UpvoteRouteEvent;

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
  queryStringParameters: {
    username: string;
    createdAt: string;
    commentUsername: string;
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

export interface UserRoutesIndexItem {
  username: string;
  createdAt: string;
  routeName: string;
  gymLocation: string;
  countryCode: string;
  publicGrade: number;
  voteCount: number;
  commentCount: number;
}

export interface RouteItem extends UserRoutesIndexItem {
  ttl: number;
  routeURL: string;
  ownerGrade: number;
  publicGradeSubmissions: Array<GradeSubmission>;
  upvotes: Array<string>;
  reports: Array<string>;
  comments: Array<Comment>;
}

export interface GymItem {
  countryCode: string;
  gymLocation: string;
  gymName: string;
}

export interface RequestGymEvent extends AuthHeader {
  body: {
    countryCode: string;
    postal: string;
    gymName: string;
  };
}

export interface CognitoUserDetails {
  userEmail: string;
  userRole: UserRole;
}

export type UserRole = 'admin' | 'user';
