const { Autohook } = require('../');
const nock = require('nock');
const assert = require('assert');
const oauth = {
  consumer_key: 'test',
  consumer_secret: 'test',
  token: 'test',
  token_secret: 'test',
};

// Success
(async () => {
  const environment = 'test';
  const userId = '100001337';
  const webhookId = '133700001337';
  const webhookUrl = 'https://example.com/webhook/1';

  const scope = nock('https://api.twitter.com')
    .post('/oauth2/token', 'grant_type=client_credentials')
    .reply(200, {token_type: 'bearer', access_token: 'test'})
    .get('/1.1/account/verify_credentials.json')
    .reply(200, {screen_name: 'TestUser'})
    .get(`/1.1/account_activity/all/${environment}/webhooks.json`)
    .reply(200, [
      {id: webhookId, url: webhookUrl},
    ])
    .delete(`/1.1/account_activity/all/${environment}/webhooks/${webhookId}.json`)
    .reply(204)
    .post(`/1.1/account_activity/all/${environment}/webhooks.json?url=${encodeURIComponent(webhookUrl)}`)
    .reply(204)
    .post(`/1.1/account_activity/all/${environment}/subscriptions.json`)
    .reply(204)
    .get('/1.1/account_activity/all/subscriptions/count.json')
    .reply(200, {subscriptions_count: 0, provisioned_count: 15})
    .delete(`/1.1/account_activity/all/${environment}/subscriptions/${userId}.json`)
    .reply(204)

  const webhook = new Autohook({...oauth, env: environment});
  await assert.doesNotReject(webhook.removeWebhooks());
  await assert.doesNotReject(webhook.start(webhookUrl));
  let subscriptionStatus = null;

  await assert.doesNotReject(async () => {
    subscriptionStatus = await webhook.subscribe({oauth_token: oauth.token, oauth_token_secret: oauth.token_secret});
  });
  
  assert.strictEqual(subscriptionStatus, true);

  let unsubscriptionStatus = null;
  await assert.doesNotReject(async () => {
    unsubscriptionStatus = await webhook.unsubscribe(userId);
  });
  assert.strictEqual(unsubscriptionStatus, true);
  scope.done();
})();