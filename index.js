#!/usr/bin/env node
const ngrok = require('ngrok');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const URL = require('url').URL;
const bearerToken = require('./bearer-token');
const { get, post, del } = require('./client');

const {
  TooManySubscriptionsError,
  UserSubscriptionError,
  WebhookURIError,
  RateLimitError,
  AuthenticationError,
  TwitterError,
} = require('./errors');

require('dotenv').config({path: path.resolve(os.homedir(), '.env.twitter')});

const emitter = new EventEmitter();

const DEFAULT_PORT = 1337;
const WEBHOOK_ROUTE = '/webhook';


let _getSubscriptionsCount = null;
const getSubscriptionsCount = async (auth) => {
  if (_getSubscriptionsCount) {
    return _getSubscriptionsCount;
  }

  const token = await bearerToken(auth);
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account_activity/all/subscriptions/count.json',
    options: { 
      bearer: token 
    },
  };

  const response = await get(requestConfig);

  switch (response.statusCode) {
    case 200:
      break;
    case 429:
      throw new RateLimitError(response);
      break;
    default:
      throw new TwitterError(response);
  }

  _getSubscriptionsCount = response.body;
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
    options: {
      bearer: await bearerToken(auth),      
    },
  };

  try {
    const response = await get(requestConfig);
    switch (response.statusCode) {
      case 200:
        break;
      case 400:
      case 401:
        throw new AuthenticationError(response);
        return [];
      case 429:
        throw new RateLimitError(response);
        return [];
      default:
        throw new URIError([
        `Cannot get webhooks. Please check that '${env}' is a valid environment defined in your`,
        `Developer dashboard at https://developer.twitter.com/en/account/environments, and that`,
        `your OAuth credentials are valid and can access '${env}'. (HTTP status: ${response.statusCode})`].join(' '));
        return [];
    }

    return response.body;
  } catch (e) {
    console.error(e.message);
    process.exit(-1);
  }
}

const deleteWebhooks = async (webhooks, auth, env) => {
  console.log('Removing webhooks…');
  for (const {id, url} of webhooks) {
    const requestConfig = {
      url: `https://api.twitter.com/1.1/account_activity/all/${env}/webhooks/${id}.json`,
      options: {
        oauth: auth,      
      },
    }

    console.log(`Removing ${url}…`);
    const response = await del(requestConfig);
    switch (response.statusCode) {
      case 200:
      case 204:
        return true;
      case 401:
        return new AuthenticationError(response);
        return false;
      case 429:
        throw new RateLimitError(response);
        return false;
      default:
        throw new URIError([
          `Cannot remove ${url}. Please make sure it belongs to '${env}', and that '${env}' is a`,
          `valid environment defined in your Developer dashboard at`,
          `https://developer.twitter.com/en/account/environments. Also check that your OAuth`,
          `credentials are valid and can access '${env}'. (HTTP status: ${response.statusCode})`,
        ].join(' '));
        return false;
    }
  }
}

const validateWebhook = (token, auth) => {
  const responseToken = crypto.createHmac('sha256', auth.consumer_secret).update(token).digest('base64');
  return {response_token: `sha256=${responseToken}`};
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
    options: {
      oauth: auth,
    },
  }

  const response = await post(requestConfig);

  switch (response.statusCode) {
    case 200:
    case 204:
      break;
    case 400:
    case 403:
     throw new AuthenticationError(response);
     return null;
    case 429:
      throw new RateLimitError(response);
      return null;
    default:
      throw new URIError([
      `Cannot get webhooks. Please check that '${env}' is a valid environment defined in your`,
      `Developer dashboard at https://developer.twitter.com/en/account/environments, and that`,
      `your OAuth credentials are valid and can access '${env}'. (HTTP status: ${response.statusCode})`].join(' '));
      return null;
  }

  return response.body;
}

const verifyCredentials = async (auth) => {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
    options: {
      oauth: auth,
    },
  };

  const response = await get(requestConfig);
  if (response.statusCode === 200) {
    return response.body.screen_name;
  } else {
    throw new UserSubscriptionError(response);
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
    headers = [],
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
    this.headers = headers;
  }

  startServer() {
    this.server = http.createServer((req, res) => {
      const route = url.parse(req.url, true);

      if (!route.pathname) {
        return;
      }

      if (route.query.crc_token) {
        const crc = validateWebhook(route.query.crc_token, this.auth);
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify(crc));
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
    
    if (!webhookUrl) {
      this.startServer();
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
      return false;
    }

    const {subscriptions_count, provisioned_count} = await getSubscriptionsCount(auth);

    if (subscriptions_count === provisioned_count) {
      throw new TooManySubscriptionsError([`Cannot subscribe to ${screen_name}'s activities:`,
       'you exceeded the number of subscriptions available to you.',
       'Please remove a subscription or upgrade your premium access at',
       'https://developer.twitter.com/apps.',
       ].join(' '));
      return false;
    }

    const requestConfig = {
      url: `https://api.twitter.com/1.1/account_activity/all/${this.env}/subscriptions.json`,
      options: {
        oauth: auth,      
      },
    };

    const response = await post(requestConfig);
    if (response.statusCode === 204) {
      console.log(`Subscribed to ${screen_name}'s activities.`);
      updateSubscriptionCount(1);
      return true;
    } else {
      throw new UserSubscriptionError(response);
      return false;
    }
  }

  async unsubscribe(userId) {
    const token = await bearerToken(this.auth);
    const requestConfig = {
      url: `https://api.twitter.com/1.1/account_activity/all/${this.env}/subscriptions/${userId}.json`,
      options: {
        bearer: token
      },
    };

    const response = await del(requestConfig);

    if (response.statusCode === 204) {
      console.log(`Unsubscribed from ${userId}'s activities.`);
      updateSubscriptionCount(-1);
      return true;
    } else {
      throw new UserSubscriptionError(response);
      return false;
    }
  }
}

module.exports = {Autohook, WebhookURIError, UserSubscriptionError, TooManySubscriptionsError, validateWebhook};