#!/usr/bin/env node
const Autohook = require('.');

const argv = require('commander')
  .description('Zero configuration setup Twitter Account Activity API webhooks (Premium).\n\nAll parameters are optional if the corresponding env variable is defined in your env file or in ~/.env.twitter.')
  .option('-t, --token <token>', 'your OAuth access token. (Env var: TWITTER_ACCESS_TOKEN)')
  .option('-s, --secret <secret>', 'your OAuth access token secret. (Env var: TWITTER_ACCESS_TOKEN_SECRET)')
  .option('-k, --consumer-key <consumerKey>', 'your OAuth consumer key. (Env var: TWITTER_CONSUMER_KEY)')
  .option('-c, --consumer-secret <consumerSecret>', 'your OAuth consumer secret. (Env var: TWITTER_CONSUMER_SECRET)')
  .option('-e, --env <env>', 'your Premium environment label as defined in https://developer.twitter.com/en/account/environments. (Env var: TWITTER_WEBHOOK_ENV)')
  .option('-p, --port <port>', 'port where the local HTTP server should run. Default: 1337. (Env var: PORT)')
  .parse(process.argv);

(async () => {
  try {
    const webhook = new Autohook({
      token: argv.token || process.env.TWITTER_ACCESS_TOKEN,
      token_secret: argv.secret || process.env.TWITTER_ACCESS_TOKEN_SECRET,
      consumer_key: argv.consumerKey || process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: argv.consumerSecret || process.env.TWITTER_CONSUMER_SECRET,
      env: argv.env || process.env.TWITTER_WEBHOOK_ENV,
      port: argv.port || process.env.PORT,
    });
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
})();