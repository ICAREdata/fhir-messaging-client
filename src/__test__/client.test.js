const Client = require('../client');
const config = require('./config.json');
const nock = require('nock');

const wellKnown = {
  "token_endpoint": "http://localhost/token",
  "token_endpoint_auth_methods_supported": ["private_key_jwt"],
  "token_endpoint_auth_signing_alg_values_supported": ["RS384", "ES384"],
  "scopes_supported": ["system/$process-message"]
};

describe('Client', () => {

  beforeEach(() => {

    const scope = nock('http://localhost')
      .get('/.well-known/smart-configuration')
      .reply(200, wellKnown);
    scope.post("/token").reply(200, {});
    scope.post("/R4/$process-message").reply(200, {});

  })


  it('Can retrieve well known endpoint to configure itself', done => {

    let client = new Client(config);
    client.getTokenUrl().then((te) => {
      done(te != wellKnown.token_endpoint)
    });

  });

  it('Can generate a signedRequest', done => {

    let client = new Client(config);
    let assertion = client.generateClientAssetion(wellKnown.token_endpoint);
    done(!assertion)

  });

  it('Can make authorization request for token with signed assertion', done => {

    let client = new Client(config);
    client.authorize().then((te) => {

      done()

    });
  });


  it('Can make ', done => {

    let client = new Client(config);
    client.authorize().then((te) => {
      client.processMessage("Message").then((ret) => {
        done()
      })
    });
  });

});