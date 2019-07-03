#!/usr/bin/env node

const util = require('util');
const request = require('request');
const ngrok = require('ngrok');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

const get = util.promisify(request.get);
const del = util.promisify(request.del);
const post = util.promisify(request.post);
const put = util.promisify(request.put);

const EventEmitter = require('events');
const emitter = new EventEmitter();

const DEFAULT_PORT = 1337;
const WEBHOOK_ROUTE = '/webhook';

const invariant = (assert, msg = null) => {
  if (!assert) {
    throw new Error(msg || 'Invariant violation.');
    process.exit(-1);
  }
}

const bearerToken = async (auth) => {
  const requestConfig = {
    url: 'https://api.twitter.com/oauth2/token',
    auth: {
      user: auth.consumer_key,
      pass: auth.consumer_secret,
    },
    form: {
      grant_type: 'client_credentials',
    },
  };

  const response = await post(requestConfig);
  return JSON.parse(response.body).access_token;
}

const getSubscriptionsCount = async (auth) => {
  const token = await bearerToken(auth);
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account_activity/all/subscriptions/count.json',
    auth: { bearer: token },
  };

  const response = await get(requestConfig);
  return JSON.parse(response.body);
}

const getWebhooks = async (auth, env) => {
  console.log('Getting webhooks…');
  const requestConfig = {
    url: `https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`,
    oauth: auth,
  }

  const response = await get(requestConfig);
  return JSON.parse(response.body);
}

const deleteWebhooks = async (webhooks, auth, env) => {
  console.log('Removing webhooks…');
  for (const {id, url} of webhooks) {
    const requestConfig = {
      url: `https://api.twitter.com/1.1/account_activity/all/${env}/webhooks/${id}.json`,
      oauth: auth,
    }

    console.log(`Removing ${url}…`);
    await del(requestConfig);
  }
}

const validateWebhook = (token, auth, res) => {
  const responseToken = crypto.createHmac('sha256', auth.consumer_secret).update(token).digest('base64');

  res.writeHead(200, {'content-type': 'application/json'});
  res.end(JSON.stringify({response_token: `sha256=${responseToken}`}));
}

const setWebhook = async (url, auth, env) => {
  console.log(`Registering ${url} as a new webhook…`);
  const endpoint = new URL(`https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`);
  endpoint.searchParams.append('url', url);

  const requestConfig = {
    url: endpoint.toString(),
    oauth: auth,
  }

  const response = await post(requestConfig);
  return JSON.parse(response.body);
}

const verifyCredentials = async (auth) => {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
    oauth: auth,
  };

  const response = await get(requestConfig);
  return JSON.parse(response.body);
}

class Autohook extends EventEmitter {
  constructor(config = {token, token_secret, consumer_key, consumer_secret, env, port}) {
    super();
    this.auth = (({token, token_secret, consumer_key, consumer_secret}) => ({token, token_secret, consumer_key, consumer_secret}))(config);
    this.env = config.env;
    this.port = config.port || DEFAULT_PORT;
  }

  startServer() {
    this.server = http.createServer((req, res) => {
      const route = url.parse(req.url, true);

      if (!route.pathname) {
        return;
      }

      if (route.query.crc_token) {
        return validateWebhook(route.query.crc_token, this.auth, res);
      }

      if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          this.emit('event', JSON.parse(body));
          res.writeHead(200);
          res.end();
        });
      }
    }).listen(this.port);
  }

  async start() {
    this.startServer();
    const webhooks = await getWebhooks(this.auth, this.env);  
    await deleteWebhooks(webhooks, this.auth, this.env);
    const url = await ngrok.connect(PORT);
    const webhookUrl = `${url}${WEBHOOK_ROUTE}`;
    const webhook = await setWebhook(webhookUrl, this.auth, this.env);
    if (webhook.url === webhookUrl && webhook.valid) {
      console.log('Webhook created.');
      return module.exports;
    } else {
      throw new Error(e);
      return null;
    }
  }

  async subscribe({oauth_token, oauth_token_secret, screen_name = null}) {
    const auth = {
      consumer_key: this.auth.consumer_key,
      consumer_secret: this.auth.consumer_secret,
      token: oauth_token,
      token_secret: oauth_token_secret,
    };
    
    screen_name = screen_name || await verifyCredentials(auth);
    if (!screen_name) {
      throw new Error('Cannot subscribe this user: invalid OAuth credentials provided.');
      return;
    }

    const {subscriptions_count, provisioned_count} = await getSubscriptionsCount(auth);

    if (subscriptions_count === provisioned_count) {
      throw new Error([`Cannot subscribe to ${screen_name}'s activities:`,
       'you exceeded the number of subscriptions available to you.',
       'Please remove at least a subscription or upgrade your premium access at',
       'https://developer.twitter.com/apps.'
       ].join(' '));
      return;
    }

    const requestConfig = {
      url: `https://api.twitter.com/1.1/account_activity/all/${this.env}/subscriptions.json`,
      oauth: auth,
    };

    const response = await post(requestConfig);
    if (response.statusCode === 204) {
      console.log(`Subscribed to ${screen_name}'s activities.`);
    } else {
      throw new Error(`Cannot subscribe to ${screen_name}'s activities. Try again later (${response.body}).`);
    }
  }
}

module.exports = Autohook;