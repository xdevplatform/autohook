# Autohook 🎣

Autohook configures and manages [Twitter webhooks](https://developer.twitter.com/en/docs/accounts-and-users/subscribe-account-activity/guides/managing-webhooks-and-subscriptions) for you. Zero configuration. Just run and go!

![Demo](https://github.com/twitterdev/autohook/raw/master/demo.gif)

* 🚀 Spawns a server for you
* ⚙️ Registers a webhook (it removes existing webhooks if you want, and you can add more than one webhook if your Premium subscription supports it)
* ✅ Performs the CRC validation when needed
* 📝 Subscribes to your current user's context (you can always subscribe more users if you need)
* 🎧 Exposes a listener so you can pick up Account Activity events and process the ones you care about

## Usage

You can use Autohook as a module or as a command-line tool.

### Node.js module

```js
const { Autohook } = require('twitter-autohook');

(async ƛ => {
  const webhook = new Autohook();
  
  // Removes existing webhooks
  await webhook.removeWebhooks();
  
  // Listens to incoming activity
  webhook.on('event', event => console.log('Something happened:', event));
  
  // Starts a server and adds a new webhook
  await webhook.start();
  
  // Subscribes to a user's activity
  await webhook.subscribe({oauth_token, oauth_token_secret});
})();
```

### Command line

Starting Autohook from the command line is useful when you need to test your connection and subscriptions.

When started from the command line, Autohook simply provisions a webhook, subscribes your user (unless you specify `--do-not-subscribe-me`), and echoes incoming events to `stdout`.

```bash
# Starts a server, removes any existing webhook, adds a new webhook, and subscribes to the authenticating user's activity.
$ autohook -rs

# All the options
$ autohook --help
```

## OAuth

Autohook works only when you pass your OAuth credentials. You won't have to figure out OAuth by yourself – Autohook will work that out for you.

You can pass your OAuth credentials in a bunch of ways.

## Dotenv (~/.env.twitter)

Create a file named `~/.env.twitter` (sits in your home dir) with the following variables:

```bash
TWITTER_CONSUMER_KEY= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ API key
TWITTER_CONSUMER_SECRET= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ API secret key
TWITTER_ACCESS_TOKEN= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ Access token
TWITTER_ACCESS_TOKEN_SECRET= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ Access token secret
TWITTER_WEBHOOK_ENV= # https://developer.twitter.com/en/account/environments ➡️ One of 'Dev environment label' or 'Prod environment label'
NGROK_AUTH_TOKEN= # https://ngrok.com/ - (optional) Create a free account to get your auth token for stable tunnels
```

Autohook will pick up these details automatically, so you won't have to specify anything in code or via CLI.

## Env variables

Useful when you're deploying to remote servers, and can be used in conjunction with your dotenv file.

```bash

# To your current environment
export TWITTER_CONSUMER_KEY= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ API key
export TWITTER_CONSUMER_SECRET= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ API secret key
export TWITTER_ACCESS_TOKEN= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ Access token
export TWITTER_ACCESS_TOKEN_SECRET= # https://developer.twitter.com/en/apps ➡️ Your app ID ➡️ Details ➡️ Access token secret
export TWITTER_WEBHOOK_ENV= # https://developer.twitter.com/en/account/environments ➡️ One of 'Dev environment label' or 'Prod environment label'
export NGROK_AUTH_TOKEN= # https://ngrok.com/ - (optional) Create a free account to get your auth token for stable tunnels

# To other services, e.g. Heroku
heroku config:set TWITTER_CONSUMER_KEY=value TWITTER_CONSUMER_SECRET=value TWITTER_ACCESS_TOKEN=value TWITTER_ACCESS_TOKEN_SECRET=value TWITTER_WEBHOOK_ENV=value NGROK_AUTH_TOKEN=value
```
## Directly

Not recommended, because you should always [secure your credentials](https://developer.twitter.com/en/docs/basics/authentication/guides/securing-keys-and-tokens.html).

### Node.js

```js
new Autohook({
  token: 'value',
  token_secret: 'value',
  consumer_key: 'value',
  consumer_secret: 'value',
  ngrok_secret: 'value', // optional
  env: 'env',
  port: 1337
});
```

### CLI

```bash
$ autohook \
  --token $TWITTER_ACCESS_TOKEN \
  --secret $TWITTER_ACCESS_TOKEN_SECRET \
  --consumer-key $TWITTER_CONSUMER_KEY \
  --consumer-secret $TWITTER_CONSUMER_SECRET \
  --env $TWITTER_WEBHOOK_ENV \
  --ngrok-secret $NGROK_AUTH_TOKEN # optional
```

## Install

```bash
# npm
$ npm i -g twitter-autohook

# Yarn
$ yarn global add twitter-autohook
```
