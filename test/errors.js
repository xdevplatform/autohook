const {
  TwitterError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
} = require('../errors');
const response = {
  body: {
    errors: [{
      message: 'test error',
      code: 1337,
    }],
  }
};

const body = JSON.stringify(response.body);

const assert = (e) => {
  console.log(`Trowing ${e.name}`);
  console.log(e.message === 'test error');
  console.log(e.code === 1337);
}
try {
  throw new TwitterError({body: body}); 
} catch(e) {
  assert(e);
}

try {
  throw new UserSubscriptionError({
    body: body, 
    headers: {
    'x-rate-limit-reset': new Date().getTime(),
  }}); 
} catch(e) {
  assert(e);
}

try {
  throw new WebhookURIError({body: body}); 
} catch(e) {
  assert(e);
}
