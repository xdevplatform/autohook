const {Autohook} = require('..');

const qs = require('querystring');
const request = require('request');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
const util = require('util');
const path = require('path');
const os = require('os');
const URL = require('url').URL;

const get = util.promisify(request.get);
const post = util.promisify(request.post);
const sleep = util.promisify(setTimeout);

const requestTokenURL = new URL('https://api.twitter.com/oauth/request_token');
const accessTokenURL = new URL('https://api.twitter.com/oauth/access_token');
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');

async function input(prompt) {
  return new Promise(async (resolve, reject) => {
    readline.question(prompt, (out) => {
      readline.close();
      resolve(out);
    });
  });
}

async function accessToken({oauth_token, oauth_token_secret}, verifier) {
  const oAuthConfig = {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    token: oauth_token,
    token_secret: oauth_token_secret,
    verifier: verifier,
  }; 
  
  const req = await post({url: accessTokenURL, oauth: oAuthConfig});
  if (req.body) {
    return qs.parse(req.body);
  } else {
    throw new Error('Cannot get an OAuth access token');
  }
}

async function requestToken() {
  const oAuthConfig = {
    callback: 'oob',
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  };

  const req = await post({url: requestTokenURL, oauth: oAuthConfig});
  if (req.body) {
    return qs.parse(req.body);
  } else {
    throw new Error('Cannot get an OAuth request token');
  }
}

async function markAsRead(messageId, senderId, auth) {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/direct_messages/mark_read.json',
    form: {
      last_read_event_id: messageId,
      recipient_id: senderId,
    },
    oauth: auth,
  };

  await post(requestConfig);
}

async function indicateTyping(senderId, auth) {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/direct_messages/indicate_typing.json',
    form: {
      recipient_id: senderId,
    },
    oauth: auth,
  };

  await post(requestConfig);
}

async function sayHi(event, oauth) {
  // Only react to direct messages
  if (!event.direct_message_events) {
    return;
  }

  const message = event.direct_message_events.shift();

  // Filter out empty messages or non-message events
  if (typeof message === 'undefined' || typeof message.message_create === 'undefined') {
    return;
  }
 
  // Filter out messages created by the the authenticating users (to avoid sending messages to oneself)
  if (message.message_create.sender_id === message.message_create.target.recipient_id) {
    return;
  }

  const oAuthConfig = {
    token: oauth.oauth_token,
    token_secret: oauth.oauth_token_secret,
    consumer_key: oauth.consumer_key,
    consumer_secret: oauth.consumer_secret,
  };


  await markAsRead(message.message_create.id, message.message_create.sender_id, oAuthConfig);
  await indicateTyping(message.message_create.sender_id, oAuthConfig);
  const senderScreenName = event.users[message.message_create.sender_id].screen_name;

  console.log(`${senderScreenName} says ${message.message_create.message_data.text}`);

  const requestConfig = {
    url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
    oauth: oAuthConfig,
    json: {
      event: {
        type: 'message_create',
        message_create: {
          target: {
            recipient_id: message.message_create.sender_id,
          },
          message_data: {
            text: `Hi @${senderScreenName}! 👋`,
          },
        },
      },
    },
  };
  await post(requestConfig);
}

(async () => {
  try {

    // Get request token
    const oAuthRequestToken = await requestToken();
    
    // Get authorization
    authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.oauth_token);
    console.log('Please go here and authorize:', authorizeURL.href);
    const pin = await input('Paste the PIN here: ');
    
    // Get the access token
    const userToMonitor = await accessToken(oAuthRequestToken, pin.trim());
    const webhook = new Autohook({
      token: process.env.TWITTER_ACCESS_TOKEN,
      token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      env: process.env.TWITTER_WEBHOOK_ENV});

    webhook.on('event', async (event) => {
      await sayHi(event, {
        oauth_token: userToMonitor.oauth_token,
        oauth_token_secret: userToMonitor.oauth_token_secret,
        user_id: userToMonitor.user_id,
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        reset: true,
      });
    });

    webhook.on('event', async (event) => {
      console.log('We received an event!');
      await sayHi(event, {
        oauth_token: userToMonitor.oauth_token,
        oauth_token_secret: userToMonitor.oauth_token_secret,
        user_id: userToMonitor.user_id,
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        reset: true,
      });
    });

    await webhook.removeWebhooks();
    await webhook.start();
    await webhook.subscribe(userToMonitor);
    
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
})();