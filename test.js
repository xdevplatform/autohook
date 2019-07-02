const autoWebhooks = require('./index');

const qs = require('querystring');
const request = require('request');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
const util = require('util');

const get = util.promisify(request.get);
const post = util.promisify(request.post);

const requestTokenURL = new URL('https://api.twitter.com/oauth/request_token');
const accessTokenURL = new URL('https://api.twitter.com/oauth/access_token');
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const endpointURL = new URL('https://api.twitter.com/labs/1/users');

const params = {
  usernames: 'TwitterDev',
};

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
    throw new Error('Cannot get an OAuth request token');
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

(async () => {
  try {

    // Get request token
    const oAuthRequestToken = await requestToken();
    
    // Get authorization
    authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.oauth_token);
    console.log('Please go here and authorize:', authorizeURL.href);
    const pin = await input('Paste the PIN here: ');
    
    // Get the access token
    const oAuthAccessToken = await accessToken(oAuthRequestToken, pin.trim());
    autoWebhooks.on('event', (req, res) => {console.log('event:', req)})
    await autoWebhooks.start({
      token: process.env.TWITTER_ACCESS_TOKEN,
      token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      env: 'dev'});

    await autoWebhooks.subscribe({token: oAuthAccessToken.oauth_token, token_secret: oAuthAccessToken.oauth_token_secret});
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
})();