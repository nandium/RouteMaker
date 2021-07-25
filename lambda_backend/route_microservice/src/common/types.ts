interface AuthHeader {
  headers: {
    Authorization: string;
  };
}

interface OptionalAuthHeader {
  headers: {
    Authorization?: string;
  };
}

export interface GetGymsByCountryEvent {
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

export interface GetRoutesByGymEvent extends OptionalAuthHeader {
  queryStringParameters: {
    gymLocation: string;
  };
}

export interface GetRoutesByUserEvent extends OptionalAuthHeader {
  queryStringParameters: {
    username: string;
  };
}

export interface GetRouteDetailsEvent extends OptionalAuthHeader {
  body: {
    username: string;
    createdAt: string;
  };
}

export interface ToggleUpvoteRouteEvent extends AuthHeader {
  body: {
    username: string;
    createdAt: string;
  };
}

export type ReportRouteEvent = ToggleUpvoteRouteEvent;

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

/**
 * Refer to lambda_backend/database_setup/serverless.yml for the attributes
 */
export interface GymLocationIndexItem {
  username: string;
  createdAt: string;
  routeName: string;
  gymLocation: string;
  publicGrade: number;
  commentCount: number;
  upvotes: Array<string>;
}

/**
 * Refer to lambda_backend/database_setup/serverless.yml for the attributes
 */
export interface UserRoutesIndexItem extends GymLocationIndexItem {
  countryCode: string;
}

/**
 * Refer to lambda_backend/database_setup/serverless.yml for the attributes
 */
export interface RouteItem extends UserRoutesIndexItem {
  ttl: number;
  routeURL: string;
  ownerGrade: number;
  publicGradeSubmissions: Array<GradeSubmission>;
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

/**
 * Refer to AWS Cognito User Pool Attributes
 */
export interface CognitoUserDetails {
  userEmail: string;
  userRole: UserRole;
}

/**
 * Refer to lambda_backend/user/signup.ts and lambda_backend/user/enableAdmin.ts
 */
export type UserRole = 'admin' | 'user';
