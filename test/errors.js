const assert = require('assert');
const {
  TwitterError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
  TooManySubscriptionsError,
  BearerTokenError,
} = require('../errors');
const response = {
  statusCode: 200,
  body: {
      errors: [{
        message: 'test error',
        code: 1337,
      }],
    },
  req: {
    path: '/example',
  },
  headers: {
    'x-rate-limit-reset': new Date().getTime(),
  }
};

const message = 'test error (HTTP status: 200, Twitter code: 1337)';
const rateLimitMessage = 'You exceeded the rate limit for /example. Wait until rate limit resets and try again.';

assert.throws(() => {
  throw new TwitterError(response)
}, {
  name: 'TwitterError',
  message: message,
});

assert.throws(() => {
  throw new BearerTokenError(response)
}, {
  name: 'BearerTokenError',
  message: message,
});

assert.throws(() => {
  throw new UserSubscriptionError(response)
}, {
  name: 'UserSubscriptionError',
  message: message,
});

assert.throws(() => {
  throw new WebhookURIError(response)
}, {
  name: 'WebhookURIError',
  message: message,
});

assert.throws(() => {
  throw new TooManySubscriptionsError(response)
}, {
  name: 'TooManySubscriptionsError',
  message: message,
});

assert.throws(() => {
  throw new RateLimitError(response)
}, {
  name: 'RateLimitError',
  message: rateLimitMessage,
});