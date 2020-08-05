#!/usr/bin/env node
const {
  Autohook,
  TooManyWebhooksError,
  UserSubscriptionError,
} = require('.');
const path = require('path');
const os = require('os');

require('dotenv').config({path: path.resolve(os.homedir(), '.env.twitter')});


const argv = require('commander')
  .description('Zero configuration setup Twitter Account Activity API webhooks (Premium).\n\nAll parameters are optional if the corresponding env variable is defined in your env file or in ~/.env.twitter.')
  .option('--token <token>', 'your OAuth access token. (Env var: TWITTER_ACCESS_TOKEN)')
  .option('--secret <secret>', 'your OAuth access token secret. (Env var: TWITTER_ACCESS_TOKEN_SECRET)')
  .option('--consumer-key <consumerKey>', 'your OAuth consumer key. (Env var: TWITTER_CONSUMER_KEY)')
  .option('--consumer-secret <consumerSecret>', 'your OAuth consumer secret. (Env var: TWITTER_CONSUMER_SECRET)')
  .option('--ngrok-secret <authToken>', 'your ngrok authtoken. (Env var: NGROK_AUTH_TOKEN)')
  .option('--env <env>', 'your Premium environment label as defined in https://developer.twitter.com/en/account/environments. (Env var: TWITTER_WEBHOOK_ENV)')
  .option('--port <port>', 'port where the local HTTP server should run. Default: 1337. (Env var: PORT)')
  .option('--url <url>', 'URL to an existing webhook configured to respond to Twitter')
  .option('-s, --subscribe-me', 'subscribes the app to listen to activities from your user context specified by the current access token credentials')
  .option('--subscribe <accessToken:accessTokenSecret>', 'subscribes to activities of the Twitter user idenfified by the specified OAuth credentials', (val, prev) => {
    const [oauth_token, oauth_secret] = val.split(':');
    const oauth = {oauth_token, oauth_secret};
    prev.push(oauth);
    return prev;
  }, [])
  .option('-r, --reset', 'remove existing webhooks from the specified environment before starting a new instance')
  .parse(process.argv);

const webhook = new Autohook({
  token: argv.token || process.env.TWITTER_ACCESS_TOKEN,
  token_secret: argv.secret || process.env.TWITTER_ACCESS_TOKEN_SECRET,
  consumer_key: argv.consumerKey || process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: argv.consumerSecret || process.env.TWITTER_CONSUMER_SECRET,
  env: argv.env || process.env.TWITTER_WEBHOOK_ENV,
  port: argv.port || process.env.PORT,
});

webhook.on('event', event => console.log(JSON.stringify(event, null, 2)));

const subscribe = async (auth) => {
  try {
    webhook.subscribe(auth);
  } catch(e) {
    console.error(e.message);
    process.exit(-1);
  }
  
}

(async () => {
  if (!!argv.reset) {
    await webhook.removeWebhooks();
  }

  try {
    await webhook.start(argv.url || null);  
  } catch(e) {
    switch (e.constructor) {
      case TooManyWebhooksError:
        console.error('Cannot add webhook: you have exceeded the number of webhooks available', 
          `to you for the '${argv.env || process.env.TWITTER_WEBHOOK_ENV}' environment.`,
          `Use 'autohook -r' to remove your existing webhooks or remove callbacks manually`,
          'using the Twitter API.');
        break;
      default:
        console.error('Error:', e.message); 
        break;        
    }

    process.exit(-1);

  }

  if (!!argv.subscribeMe) {
    await subscribe({
      oauth_token: argv.token || process.env.TWITTER_ACCESS_TOKEN,
      oauth_token_secret: argv.secret || process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });    
  }

  for (oauth in argv.subscribe) {
    await subscribe(oauth);
  }

})();
