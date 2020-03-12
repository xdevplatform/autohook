const needle = require('needle');
const crypto = require('crypto');
const package = require('../package.json');
const { URL, URLSearchParams } = require('url');
const qs = require('qs');
const { oauth } = require('../oauth');
needle.defaults({user_agent: `${package.name}/${package.version}`})

const auth = (method, url, body, options) => {
  if (Object.prototype.toString.call(options) !== '[object Object]') {
    return {};
  }

  options.headers = options.headers || {};
  if (options.oauth) {
    options.headers.authorization = oauth(url, method, body, options);
  } else if (options.bearer) {
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
