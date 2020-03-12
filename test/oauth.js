const assert = require('assert');
const oauthInstance = require('../oauth');
const URL = require('url').URL;

const oAuthConfig = {
  oauth: {
    consumer_key: 'consumer_key',
    consymer_secret: 'consumer_secret',
    token: 'test_user_token',
    token_secret: 'test_user_token_secret',
  },
};

const signatures = {
  baseUrl: 'OAuth oauth_consumer_key="consumer_key", oauth_nonce="GXjhffMbAMz2qblDzzgYbP4ZkfPp7RGmhry5Upatw", oauth_signature="RGpMnOI1WxKDZtgORbi32uc8P%2BY%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1583967563", oauth_token="test_user_token", oauth_version="1.0"',
  urlWithParams: 'OAuth oauth_consumer_key="consumer_key", oauth_nonce="xaCqEY8Ed9vnfFvZJsu8AjSF1", oauth_signature="LYT0mRAq62MXsnxsTOppEtViTUs%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1583967750", oauth_token="test_user_token", oauth_version="1.0"',
};

const baseUrl = new URL('https://api.twitter.com/1.1/account/verify_credentials.json')
oauthInstance.setNonceFn(() => 'GXjhffMbAMz2qblDzzgYbP4ZkfPp7RGmhry5Upatw');
oauthInstance.setTimestampFn(() => '1583967563');
assert.throws(() => {
  // non-object and non string body throws TypeError
  oauthInstance.oauth(baseUrl, 'GET', oAuthConfig, () => {});
}, {
  name: 'TypeError',
});
assert.equal(oauthInstance.oauth(baseUrl, 'GET', oAuthConfig), signatures.baseUrl);
assert.equal(oauthInstance.oauth(baseUrl, 'GET', oAuthConfig, {}), signatures.baseUrl);
assert.equal(oauthInstance.oauth(baseUrl, 'GET', oAuthConfig, ''), signatures.baseUrl);

const urlWithParams = new URL('https://api.twitter.com/1.1/account/verify_credentials.json')
urlWithParams.searchParams.append('param_test', '1');
urlWithParams.searchParams.append('example', '1');
oauthInstance.setNonceFn(() => 'xaCqEY8Ed9vnfFvZJsu8AjSF1');
oauthInstance.setTimestampFn(() => '1583967750');
assert.equal(oauthInstance.oauth(urlWithParams, 'GET', oAuthConfig), signatures.urlWithParams);

const urlWithBodyParams = new URL('https://api.twitter.com/1.1/account/verify_credentials.json');
const bodyParams = {
  param_test: '1',
  example: '1'
};

assert.equal(oauthInstance.oauth(urlWithParams, 'GET', oAuthConfig, bodyParams), signatures.urlWithParams);
const bodyParamsString = 'param_test=1&example=1';
assert.equal(oauthInstance.oauth(urlWithParams, 'GET', oAuthConfig, bodyParamsString), signatures.urlWithParams);