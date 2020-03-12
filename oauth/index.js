const { URL } = require('url');
const crypto = require('crypto');

const encode = (str) =>
  encodeURIComponent(str)
    .replace(/!/g,'%21')
    .replace(/\*/g,'%2A')
    .replace(/\(/g,'%28')
    .replace(/\)/g,'%29')
    .replace(/'/g,'%27');

const oAuthFunctions = {
  nonceFn: null,
  timestampFn: null, 
};

const nonceFn = (length = 16) => crypto.randomBytes(length).toString('base64');
const timestampFn = () => Math.floor(Date.now() / 1000).toString();

const setNonceFn = (fn) => oAuthFunctions.nonceFn = fn;
const setTimestampFn = (fn) => oAuthFunctions.timestampFn = fn;

const parameters = (url, body = {}, auth) => {
  let params = {};

  const urlObject = new URL(url);
  for (const key of urlObject.searchParams.keys()) {
    params[key] = urlObject.searchParams.get(key);
  }

  if (Object.prototype.toString.call(body) !== '[object Object]') {
    throw TypeError('OAuth parameters: body must be an object');
  }

  for (const key of Object.keys(body)) {
    params[key] = encode(body[key]);
  }    

  params.oauth_consumer_key = auth.consumer_key;
  params.oauth_token = auth.token;
  params.oauth_nonce = oAuthFunctions.nonceFn() || nonceFn();
  params.oauth_timestamp = oAuthFunctions.timestampFn() || timestampFn();
  params.oauth_signature_method = 'HMAC-SHA1';
  params.oauth_version = '1.0';
  return params;
}

const parameterString = (url, auth, params) => {
  const sortedKeys = Object.keys(params).sort();

  let sortedParams = [];
  for (const key of sortedKeys) {
    sortedParams.push(`${key}=${encode(params[key])}`);
  }

  return sortedParams.join('&');
  
}

const hmacSha1Signature = (baseString, signingKey) => 
  crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

const signatureBaseString = (url, method, paramString) => {
  const urlObject = new URL(url);
  const baseURL = urlObject.origin + urlObject.pathname;
  return `${method.toUpperCase()}&${encode(baseURL)}&${encode(paramString)}`;
}

const createSigningKey = ({consumer_secret, token_secret}) => `${encode(consumer_secret)}&${encode(token_secret)}`;

const header = (url, auth, signature, params) => {
  params.oauth_signature = signature;
  const sortedKeys = Object.keys(params).sort();

  const sortedParams = [];
  for (const key of sortedKeys) {
    if (key.indexOf('oauth_') !== 0) {
      continue;
    }

    sortedParams.push(`${key}="${encode(params[key])}"`);
  }

  return `OAuth ${sortedParams.join(', ')}`;

}

const oauth = (url, method, body, {oauth}) => {
  const params = parameters(url, body, oauth);
  const paramString = parameterString(url, oauth, params);
  const baseString = signatureBaseString(url, method, paramString);
  const signingKey = createSigningKey(oauth);
  const signature = hmacSha1Signature(baseString, signingKey);
  const signatureHeader = header(url, oauth, signature, params);
  return signatureHeader;
}

module.exports = {oauth, setNonceFn, setTimestampFn};