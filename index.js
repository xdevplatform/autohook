#!/usr/bin/env node

const util = require('util');
const request = require('request');
const ngrok = require('ngrok');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

require('dotenv').config({path: path.resolve(os.homedir(), '.env.twitter')});

const get = util.promisify(request.get);
const del = util.promisify(request.del);
const post = util.promisify(request.post);
const put = util.promisify(request.put);

const EventEmitter = require('events');
const emitter = new EventEmitter();

const DEFAULT_PORT = 1337;
const WEBHOOK_ROUTE = '/webhook';

class TooManyWebhooksError extends Error {}
class UserSubscriptionError extends Error {}

const invariant = (assert, msg = null) => {
  if (!assert) {
    throw new Error(msg || 'Invariant violation.');
    process.exit(-1);
  }
}

let _bearerToken = null;
const bearerToken = async (auth) => {
  if (_bearerToken) {
    return _bearerToken;
  }

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
  _bearerToken = JSON.parse(response.body).access_token;
  return _bearerToken;
}

let _getSubscriptionsCount = null;
const getSubscriptionsCount = async (auth) => {
  if (_getSubscriptionsCount) {
    return _getSubscriptionsCount;
  }

  const token = await bearerToken(auth);
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account_activity/all/subscriptions/count.json',
    auth: { bearer: token },
  };

  const response = await get(requestConfig);
  _getSubscriptionsCount = JSON.parse(response.body);
  return _getSubscriptionsCount;
}

const updateSubscriptionCount = increment => {
  if (!_getSubscriptionsCount) {
    return;
  }

  _getSubscriptionsCount.subscriptions_count += increment;
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
  const body = JSON.parse(response.body);

  if (body.errors) {
    const error = body.errors[0];
    if (error.code === 214) {
      throw new TooManyWebhooksError();
    }
  }

  return body;
}

const verifyCredentials = async (auth) => {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
    oauth: auth,
  };

  const response = await get(requestConfig);
  return JSON.parse(response.body).screen_name;
}

class Autohook extends EventEmitter {
  constructor({
    token = process.env.TWITTER_ACCESS_TOKEN,
    token_secret = process.env.TWITTER_ACCESS_TOKEN_SECRET,
    consumer_key = process.env.TWITTER_CONSUMER_KEY,
    consumer_secret = process.env.TWITTER_CONSUMER_SECRET,
    env = process.env.TWITTER_WEBHOOK_ENV,
    port = process.env.PORT,
  }) {

    super();
    this.auth = {token, token_secret, consumer_key, consumer_secret};
    this.env = env;
    this.port = port || DEFAULT_PORT;
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
          this.emit('event', JSON.parse(body), req);
          res.writeHead(200);
          res.end();
        });
      }
    }).listen(this.port);
  }

  async removeWebhooks() {
    const webhooks = await getWebhooks(this.auth, this.env);
    await deleteWebhooks(webhooks, this.auth, this.env);
  }

  async start(webhookUrl = null) {
    this.startServer();
    
    if (!webhookUrl) {
      const url = await ngrok.connect(this.port);
      webhookUrl = `${url}${WEBHOOK_ROUTE}`;      
    }
    
    try {
      const webhook = await setWebhook(webhookUrl, this.auth, this.env);  
      console.log('Webhook created.');
    } catch(e) {
      throw e;
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
      throw new UserSubscriptionError('Cannot subscribe this user: invalid OAuth credentials provided.');
      return;
    }

    const {subscriptions_count, provisioned_count} = await getSubscriptionsCount(auth);

    if (subscriptions_count === provisioned_count) {
      throw new UserSubscriptionError([`Cannot subscribe to ${screen_name}'s activities:`,
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
    try {
      const response = await post(requestConfig);  
      if (response.statusCode === 204) {
        console.log(`Subscribed to ${screen_name}'s activities.`);
        updateSubscriptionCount(1);
      } else {
        const message = JSON.parse(response.body);
        throw new UserSubscriptionError(`Cannot subscribe to ${screen_name}'s activities: ${message.errors[0].message} (Twitter code: ${message.errors[0].code}).`);
        return;
      }
    } catch(e) {
      throw e;
    }
    
  }
}

module.exports = {Autohook, TooManyWebhooksError, UserSubscriptionError, setWebhook, validateWebhook};