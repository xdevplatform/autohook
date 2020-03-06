const needle = require('needle');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const oauthSignature = require('oauth-sign');
const package = require('../package.json');
const { URL, URLSearchParams } = require('url');
const qs = require('qs');
const oauth = require('../oauth');
needle.defaults({user_agent: `${package.name}/${package.version}`})

const oauthHeader = (url, method, body, options) => {
  const oa = new OAuth({
    consumer: {
      key: options.oauth.consumer_key,
      secret: options.oauth.consumer_secret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (base_string, key) => crypto.createHmac('sha1', key).update(base_string).digest('base64'),
  });

  const token = {
    key: options.oauth.token,
    secret: options.oauth.token_secret,
  };

  console.log(token);

  const urlObject = new URL(url);
  let data = {};
  for (const key of urlObject.searchParams.keys()) {
    data[key] = urlObject.searchParams.get(key);
  }

  
  const request = {
    url: url,
    method: method,
    data: data
  };


  return oa.toHeader(oa.authorize(request, token))['Authorization'];

}

const auth = (method, url, body, options) => {
  options.headers = options.headers || {};
  if (options.oauth) {
    options.headers.authorization = oauth(url, method, body, options);
  }

  if (options.bearer) {
    options.headers.authorization = `Bearer ${options.bearer}`;
  }

  return options;
}

const get = ({url, ...options}) => {
  method = 'GET';
  options.options = auth(method, url, {}, options.options);
  return needle(method, url, null, options.options);
}

const del = ({url, ...options}) => {
  method = 'DELETE';
  options.options = auth(method, url, {}, options.options);
  return needle(method, url, null, options.options);
}

const post = ({url, body = null, ...options}) => {
  method = 'POST';
  options.options = auth(method, url, body, options.options);
  return needle(method, url, body, options.options);
}

const put = ({url, body = null, ...options}) => {
  method = 'PUT';
  options.options = auth(method, url, body, options.options);
  return needle(method, url, body, options.options);
}

module.exports = { get, del, post, put };
