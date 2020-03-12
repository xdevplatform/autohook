const nock = require('nock');
const bearerToken = require('../bearer-token');
const assert = require('assert');

const tokenValue = 'access_token_from_api';

(async () => {
  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token')
    .reply(200, {token_type: 'bearer', access_token: 'access_token_from_api'});

  let token = null;
  await assert.doesNotReject(async () => {
    token = await bearerToken({
      consumer_key: 'test_consumer_key',
      consumer_secret: 'test_consumer_secret',
    });  
  });
  
  assert.equal(token, tokenValue);
  scope.done();
})();

(async () => {
  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token')
    .reply(503, {
      errors: [{
        message: 'test error',
        code: 1337,
      }],
    });

  await assert.rejects(async () => {
    const token = await bearerToken({
      consumer_key: 'test_consumer_key',
      consumer_secret: 'test_consumer_secret',
    });
  }, {
    name: 'BearerTokenError',
  });
  scope.done();
})();
