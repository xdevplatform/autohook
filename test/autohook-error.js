const { Autohook } = require('../');
const nock = require('nock');
const assert = require('assert');
const oauth = {
  consumer_key: 'test',
  consumer_secret: 'test',
  token: 'test',
  token_secret: 'test',
};

const errorMessage = 'test error';
const response = {
  statusCode: 403,
  body: {
      errors: [{
        message: errorMessage,
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

const environment = 'test';
const userId = '100001337';
const webhookId = '133700001337';
const webhookUrl = 'https://example.com/webhook/1';

const webhook = new Autohook({...oauth, env: environment});

// Bearer token error
(async () => {
  response.statusCode = 403;
  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token', 'grant_type=client_credentials')
    .reply(() => [response.statusCode, response.body, response.headers])
  await assert.rejects(webhook.removeWebhooks(), {
    name: 'BearerTokenError'
  });
  nock.cleanAll();
})();


// URIError on getWebhooks
(async () => {
  response.statusCode = 555;
  nock.cleanAll();
  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token', 'grant_type=client_credentials')
    .reply(200, {token_type: 'bearer', access_token: 'test'})
    .get(`/1.1/account_activity/all/${environment}/webhooks.json`)
    .reply(() => [response.statusCode, response.body, response.headers])

  await assert.rejects(webhook.removeWebhooks(), {
    name: 'URIError'
  });
  nock.cleanAll();
})();

// URIError on deleteWebhooks
(async () => {
  response.statusCode = 555;
  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token', 'grant_type=client_credentials')
    .reply(200, {token_type: 'bearer', access_token: 'test'})
    .get(`/1.1/account_activity/all/${environment}/webhooks.json`)
    .reply(200, [{id: webhookId, url: webhookUrl}])
    .delete(`/1.1/account_activity/all/${environment}/webhooks/${webhookId}.json`)
    .reply(() => [response.statusCode, response.body, response.headers])

  await assert.rejects(webhook.removeWebhooks(), {
    name: 'URIError'
  });
  nock.cleanAll();
})();

