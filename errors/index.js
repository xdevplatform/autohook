class TwitterError extends Error {
  constructor(responseBody) {
    const body = JSON.parse(responseBody);
    let message, code;
    if (!Array.isArray(body.errors)) {
      message = body || 'Unknown error';
    } else {
      message = body.errors[0].message;
      code = body.errors[0].code;
    }

    super(`${message}` + (code ? ` (Twitter code: ${code})` : ''));
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class WebhookURIError extends TwitterError {}
class UserSubscriptionError extends TwitterError {}
class TooManySubscriptionsError extends Error {}

module.exports = { TwitterError, WebhookURIError, UserSubscriptionError, TooManySubscriptionsError };