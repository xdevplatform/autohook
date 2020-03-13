const assert = require('assert');
const {
  AuthenticationError,
  TwitterError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
  TooManySubscriptionsError,
  BearerTokenError,
  tryError,
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
    'x-rate-limit-limit': '900',
    'x-rate-limit-reset': Math.round(Date.now() / 1000) + 900
  }
};

const errors = [
  {statusCode: 400, details: {errorClass: AuthenticationError, message: 'test error (HTTP status: 400, Twitter code: 1337)'}},
  {statusCode: 401, details: {errorClass: AuthenticationError, message: 'test error (HTTP status: 401, Twitter code: 1337)'}},
  {statusCode: 401, details: {errorClass: WebhookURIError, message: 'test error (HTTP status: 401, Twitter code: 1337)'}},
  {statusCode: 401, details: {errorClass: TooManySubscriptionsError, message: 'test error (HTTP status: 401, Twitter code: 1337)'}},
  {statusCode: 403, details: {errorClass: AuthenticationError, message: 'test error (HTTP status: 403, Twitter code: 1337)'}},
  {statusCode: 403, details: {errorClass: BearerTokenError, message: 'test error (HTTP status: 403, Twitter code: 1337)'}},
  {statusCode: 429, details: {errorClass: RateLimitError, message: 'You exceeded the rate limit for /example (900 requests available, 0 remaining). Wait 15 minutes before trying again.'}},
  {statusCode: 503, details: {errorClass: TwitterError, message: 'test error (HTTP status: 503, Twitter code: 1337)'}},
  {statusCode: 503, details: {errorClass: UserSubscriptionError, message: 'test error (HTTP status: 503, Twitter code: 1337)'}},
];

for (error of errors) {
  response.statusCode = error.statusCode;
  assert.throws(() => {
    throw new error.details.errorClass(response);
  },
  {
    name: error.details.errorClass.name,
    message: error.details.message,
  });
}