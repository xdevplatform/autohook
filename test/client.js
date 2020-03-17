const { post } = require('../client');
const oauthInstance = require('../oauth');
const qs = require('querystring');
const nock = require('nock');
const assert = require('assert');

(async () => {
  const oAuthConfig = {
    consumer_key: 'consumer_key',
    consumer_secret: 'consumer_secret',
    token: 'test_user_token',
    token_secret: 'test_user_token_secret',
  };

  const baseURL = 'https://example.com';
  const formRoute = '/form';
  const jsonRoute = '/json';
  const oauthRoute = '/oauth';

  const mockData = {
    form: {
      nonce: 'v9jKGGxfQiD2u09dgcFucmyCXKckcpGprlojZhxV4',
      timestamp: '1584380758',
      body: qs.stringify({test_value: 42, form: true, json: false}),
      contentType: 'application/x-www-form-urlencoded',
      oauth: 'OAuth oauth_consumer_key="consumer_key", oauth_nonce="v9jKGGxfQiD2u09dgcFucmyCXKckcpGprlojZhxV4", oauth_signature="7KNZQnQi9ZnV9289OmqE4Xg7dck%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1584380758", oauth_token="test_user_token", oauth_version="1.0"',  
    },
    json: {
      nonce: 'kCMhnYwha4MIuIIRVbYt62A9eoIboIP8',
      timestamp: '1584407161',
      body: {test_value: 42, form: false, json: true},
      contentType: 'application/json; charset=utf-8',
      oauth: 'OAuth oauth_consumer_key="consumer_key", oauth_nonce="kCMhnYwha4MIuIIRVbYt62A9eoIboIP8", oauth_signature="4oV4jRsCON%2FbLeCePh5zR%2Bd73MI%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1584407161", oauth_token="test_user_token", oauth_version="1.0"',  
    },
  };

  const replyCallback = function(route, requestBody) {
    return [200, {
      body: requestBody,
      headers: {
        contentType: this.req.headers['content-type'],
        oauth: this.req.headers.authorization || null,  
      },
    }];
  };

  const scope = nock(baseURL)
    .post(formRoute).reply(replyCallback)
    .post(jsonRoute).reply(replyCallback)
    .post(`${formRoute}${oauthRoute}`).reply(replyCallback)
    .post(`${jsonRoute}${oauthRoute}`).reply(replyCallback);

  const formResponse = await post({url: `${baseURL}${formRoute}`, body: mockData.form.body});
  assert.deepEqual(formResponse.body.body, mockData.form.body);
  assert.equal(formResponse.body.headers.contentType, mockData.form.contentType);
  
  oauthInstance.setNonceFn(() => mockData.form.nonce);
  oauthInstance.setTimestampFn(() => mockData.form.timestamp);
  const formOAuthResponse = await post({url: `${baseURL}${formRoute}${oauthRoute}`, body: mockData.form.body, options: {oauth: oAuthConfig}});
  assert.deepEqual(formOAuthResponse.body.body, mockData.form.body);
  assert.equal(formOAuthResponse.body.headers.contentType, mockData.form.contentType);
  assert.equal(formOAuthResponse.body.headers.oauth, mockData.form.oauth);

  const jsonResponse = await post({url: `${baseURL}${jsonRoute}`, body: mockData.json.body, options: {json: true}});
  assert.deepEqual(jsonResponse.body.body, mockData.json.body);
  assert.equal(jsonResponse.body.headers.contentType, mockData.json.contentType);

  oauthInstance.setNonceFn(() => mockData.json.nonce);
  oauthInstance.setTimestampFn(() => mockData.json.timestamp);
  const jsonOAuthResponse = await post({url: `${baseURL}${jsonRoute}${oauthRoute}`, body: mockData.json.body, options: {oauth: oAuthConfig, json: true}});
  assert.deepEqual(jsonOAuthResponse.body.body, mockData.json.body);
  assert.equal(jsonOAuthResponse.body.headers.contentType, mockData.json.contentType);
  assert.equal(jsonOAuthResponse.body.headers.oauth, mockData.json.oauth);

  nock.cleanAll();
})();