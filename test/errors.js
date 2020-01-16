const {
  TwitterError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
} = require('../errors');
const response = {
  statusCode: 200,
  body: JSON.stringify({
      errors: [{
        message: 'test error',
        code: 1337,
      }],
    }),
  req: {
    path: '/example',
  },
  headers: {
  'x-rate-limit-reset': new Date().getTime(),
}
};

const assert = (e) => {
  console.log(`Trowing ${e.name}`);

  console.log(e.message === `test error (HTTP status: 200, Twitter code: 1337)`);
  console.log(e.code === 1337);
}
try {
  throw new TwitterError(response); 
} catch(e) {
  assert(e);
}

try {
  throw new UserSubscriptionError(response); 
} catch(e) {
  assert(e);
}

try {
  throw new WebhookURIError(response); 
} catch(e) {
  assert(e);
}
