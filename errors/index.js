class TwitterError extends Error {
  constructor(response) {
    const body = JSON.parse(response.body);
    let message, code;
    if (!Array.isArray(body.errors)) {
      message = body || 'Unknown error';
    } else {
      message = body.errors[0].message;
      code = body.errors[0].code;
    }

    super(`${message}` + (code ? ` (HTTP status: ${response.statusCode}, Twitter code: ${code})` : ''));
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class WebhookURIError extends TwitterError {}
class UserSubscriptionError extends TwitterError {}
class RateLimitError extends Error {
  constructor(response) {
    const body = JSON.parse(response.body);
    let message, code;
    if (!Array.isArray(body.errors)) {
      message = body || 'Unknown error';
    } else {
      message = body.errors[0].message;
      code = body.errors[0].code;
    }

    const requestAllowed = response.headers['x-rate-limit-limit'];
    const resetAt = response.headers['x-rate-limit-reset'] * 1000 - (new Date().getTime());
    const resetAtMin = Math.round(resetAt / 60 / 1000);
    super(`You exceeded the rate limit for ${response.req.path} (${requestAllowed} requests available, 0 remaining). Wait ${resetAtMin} minutes before trying again.`);
    this.resetAt = response.headers['x-rate-limit-reset'] * 1000;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
class TooManySubscriptionsError extends Error {}

module.exports = { 
  TwitterError, 
  WebhookURIError, 
  UserSubscriptionError, 
  TooManySubscriptionsError,
  RateLimitError,
};