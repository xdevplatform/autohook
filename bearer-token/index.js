const { post } = require('../client');
const { BearerTokenError } = require('../errors')

let _bearerToken = null;
const bearerToken = async (auth) => {
  if (_bearerToken) {
    return _bearerToken;
  }

  const requestConfig = {
    url: 'https://api.twitter.com/oauth2/token',
    options: {
      username: auth.consumer_key,
      password: auth.consumer_secret
    },
    body: 'grant_type=client_credentials',
  };

  const response = await post(requestConfig);
  if (response.statusCode !== 200) {
    throw new BearerTokenError(response);
  }

  _bearerToken = response.body.access_token;
  return _bearerToken;
}

module.exports = bearerToken;