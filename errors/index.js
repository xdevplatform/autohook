class TwitterError extends Error {
  constructor({body, statusCode = null}, message = null, code = null) {
    if (message === null && code === null && Array.isArray(body.errors)) {
      message = body.errors[0].message;
      code = body.errors[0].code;
    }

    super(`${message}` + (code ? ` (HTTP status: ${statusCode}, Twitter code: ${code})` : ''));
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class WebhookURIError extends TwitterError {}
class UserSubscriptionError extends TwitterError {}
class RateLimitError extends Error {
  constructor({body, req = {}, headers = {}, statusCode = null}, message = null, code = null) {

    if (message === null && code === null && Array.isArray(body.errors)) {
      message = body.errors[0].message;
      code = body.errors[0].code;
    }

    if (typeof headers !== 'undefined' && typeof headers['x-rate-limit-limit'] !== 'undefined' && typeof headers['x-rate-limit-reset'] !== 'undefined') {
      const requestAllowed = headers['x-rate-limit-limit'];
      const resetAt = headers['x-rate-limit-reset'] * 1000 - (new Date().getTime());
      const resetAtMin = Math.round(resetAt / 60 / 1000);
      super(`You exceeded the rate limit for ${req.path} (${requestAllowed} requests available, 0 remaining). Wait ${resetAtMin} minutes before trying again.`);      
    } else {
      super(`You exceeded the rate limit for ${req.path}. Wait until rate limit resets and try again.`);
    }

    this.resetAt = headers['x-rate-limit-reset'] * 1000;
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}
class TooManySubscriptionsError extends TwitterError {}
class AuthenticationError extends TwitterError {}
class BearerTokenError extends TwitterError {}

const tryError = (response, defaultError = (response) => new TwitterError(response)) => {
  switch (response.statusCode) {
    case 200:
    case 201:
    case 204:
      return false;
    case 400:
    case 401:
    case 403:
     throw new AuthenticationError(response);
     case 420:
     case 429:
      throw new RateLimitError(response);
    default:
      throw defaultError(response);
  }
};

module.exports = { 
  TwitterError, 
  WebhookURIError, 
  UserSubscriptionError, 
  TooManySubscriptionsError,
  RateLimitError,
  AuthenticationError,
  BearerTokenError,
  tryError,
};