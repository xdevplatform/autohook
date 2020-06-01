const needle = require('needle');
const crypto = require('crypto');
const package = require('../package.json');
const { URL, URLSearchParams } = require('url');
const { oauth } = require('../oauth');
needle.defaults({user_agent: `${package.name}/${package.version}`})

const auth = (method, url, options, body) => {
  if (Object.prototype.toString.call(options) !== '[object Object]') {
    return {};
  }

  options.headers = options.headers || {};
  if (options.oauth) {
    options.headers.authorization = oauth(url, method, options, !!options.json ? {} : body);
  } else if (options.bearer) {
    options.headers.authorization = `Bearer ${options.bearer}`;
  }

  return options;
}

const get = ({url, ...options}) => {
  method = 'GET';
  options.options = auth(method, url, options.options);
  return needle(method, url, null, options.options);
}

const del = ({url, ...options}) => {
  method = 'DELETE';
  options.options = auth(method, url, options.options);
  return needle(method, url, null, options.options);
}

const post = ({url, body = {}, ...options}) => {
  method = 'POST';
  options.options = auth(method, url, options.options, body);
  return needle(method, url, body, options.options);
}

const put = ({url, body = {}, ...options}) => {
  method = 'PUT';
  options.options = auth(method, url, options.options, body);
  return needle(method, url, body, options.options);
}

module.exports = { get, del, post, put };
