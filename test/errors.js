const {
  TwitterError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
  TooManySubscriptionsError,
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
  if (e instanceof RateLimitError) {
    console.log(e.message === 'You exceeded the rate limit for /example. Wait until rate limit resets and try again.');
  } else {
    console.log(e.message === `test error (HTTP status: 200, Twitter code: 1337)`);  
  }
  
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

try {
  throw new RateLimitError(response); 
} catch(e) {
  assert(e);
}

try {
  throw new TooManySubscriptionsError(response); 
} catch(e) {
  assert(e);
}
