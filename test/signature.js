const { validateSignature } = require('../');
const assert = require('assert');
const oauth = {
  consumer_key: 'test',
  consumer_secret: 'test',
  token: 'test',
  token_secret: 'test',
};

const fixtures = [
  {body: 'test=1&other_test=2', header: {'x-twitter-webhooks-signature': 'sha256=25Cu3iwbbiqBTwQRzcKJZwisjf736V2Q8UaTlkfLSoc='}},
  {body: '{"test_number":1,"test_string":"two"}', header: {'x-twitter-webhooks-signature': 'sha256=YWHphPn/JFq43jkF0y4/w8R/SelmLjvpunhVFY8JhlI='}},
]

for (const {body, header} of fixtures) {
  assert.ok(validateSignature(header, oauth, body));
}
