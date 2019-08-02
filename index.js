#!/usr/bin/env node

const util = require('util');
const request = require('request');
const ngrok = require('ngrok');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const {
  TooManySubscriptionsError,
  UserSubscriptionError,
  WebhookURIError,
} = require('./errors');

require('dotenv').config({path: path.resolve(os.homedir(), '.env.twitter')});

const get = util.promisify(request.get);
const del = util.promisify(request.del);
const post = util.promisify(request.post);
const put = util.promisify(request.put);

const emitter = new EventEmitter();

const DEFAULT_PORT = 1337;
const WEBHOOK_ROUTE = '/webhook';

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
  if (response.statusCode !== 200) {
    throw new URIError([
      `Cannot get webhooks. Please check that '${env}' is a valid environment defined in your`,
      `Developer dashboard at https://developer.twitter.com/en/account/environments, and that`,
      `your OAuth credentials are valid and can access '${env}'.`].join(' '));
  }

  try {
    return JSON.parse(response.body);
  } catch (e) {
    throw TypeError('Error while parsing the response from the Twitter API:', e.message);
    return [];
  }
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

const setWebhook = async (webhookUrl, auth, env) => {
  const parsedUrl = url.parse(webhookUrl);
  if (parsedUrl.protocol === null || parsedUrl.host === 'null') {
    throw new TypeError(`${webhookUrl} is not a valid URL. Please provide a valid URL and try again.`);
    return;
  } else if (parsedUrl.protocol !== 'https:') {
    throw new TypeError(`${webhookUrl} is not a valid URL. Your webhook must be HTTPS.`);
    return;
  }

  console.log(`Registering ${webhookUrl} as a new webhook…`);
  const endpoint = new URL(`https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`);
  endpoint.searchParams.append('url', webhookUrl);

  const requestConfig = {
    url: endpoint.toString(),
    oauth: auth,
  }

  const response = await post(requestConfig);
  const body = JSON.parse(response.body);

  if (body.errors) {
    throw new WebhookURIError(response.body);
    return null;
  }

  return body;
}

const verifyCredentials = async (auth) => {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
    oauth: auth,
  };

  const response = await get(requestConfig);
  if (response.statusCode === 200) {
    return JSON.parse(response.body).screen_name;
  } else {
    throw new UserSubscriptionError(response.body);
    return null;
  }
}

class Autohook extends EventEmitter {
  constructor({
    token = (process.env.TWITTER_ACCESS_TOKEN || '').trim(),
    token_secret = (process.env.TWITTER_ACCESS_TOKEN_SECRET || '').trim(),
    consumer_key = (process.env.TWITTER_CONSUMER_KEY || '').trim(),
    consumer_secret = (process.env.TWITTER_CONSUMER_SECRET || '').trim(),
    env = (process.env.TWITTER_WEBHOOK_ENV || '').trim(),
    port = process.env.PORT || DEFAULT_PORT,
  } = {}) {

    Object.entries({token, token_secret, consumer_key, consumer_secret, env, port}).map(el => {
      const [key, value] = el;
      if (!value) {
        throw new TypeError(`'${key}' is empty or not set. Check your configuration and try again.`);
      }
    });

    super();
    this.auth = {token, token_secret, consumer_key, consumer_secret};
    this.env = env;
    this.port = port;
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
      token: oauth_token.trim(),
      token_secret: oauth_token_secret.trim(),
    };

    try {
      screen_name = screen_name || await verifyCredentials(auth);
    } catch (e) {
      throw e;
      return;
    }

    const {subscriptions_count, provisioned_count} = await getSubscriptionsCount(auth);

    if (subscriptions_count === provisioned_count) {
      throw new TooManySubscriptionsError([`Cannot subscribe to ${screen_name}'s activities:`,
       'you exceeded the number of subscriptions available to you.',
       'Please remove a subscription or upgrade your premium access at',
       'https://developer.twitter.com/apps.',
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
      updateSubscriptionCount(1);
    } else {
      throw new UserSubscriptionError(response.body);
      return;
    }
    
  }
}

module.exports = {Autohook, WebhookURIError, UserSubscriptionError, TooManySubscriptionsError, setWebhook, validateWebhook};