const Client = require('../client');
const config = require('./config.json');
const nock = require('nock');

const wellKnown = {
  "token_endpoint": "http://localhost/token",
  "token_endpoint_auth_methods_supported": ["private_key_jwt"],
  "token_endpoint_auth_signing_alg_values_supported": ["RS384", "ES384"],
  "scopes_supported": ["system/$process-message"]
};

const fakeRepsonse = {"resourceType": "Bundle"};
describe('Client', () => {

  beforeEach(() => {

    const scope = nock('http://localhost')
      .get('/.well-known/smart-configuration')
      .reply(200, wellKnown);
    scope.post("/token").reply(200, {"access_token":"FAKE_BEAER_TOKEN"});
    scope.post("/R4/$process-message").reply(200, fakeRepsonse);

  })


  it('Can retrieve well known endpoint to configure itself', done => {

    let client = new Client(config);
    client.getTokenUrl().then((te) => {
      expect(te == wellKnown.token_endpoint)
      done(te != wellKnown.token_endpoint)
    });

  });

  it('Can generate a signedRequest', done => {
    let expectedAssertion = {
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      grant_type: 'client_credentials',
      scope: 'system/$process-message'
    };

    let client = new Client(config);
    let assertion = client.generateClientAssetion(wellKnown.token_endpoint, 1);
    expect(assertion);
    expect(assertion.client_assertion_type);
    expect(assertion.client_assertion_type).toEqual(expectedAssertion.client_assertion_type);
    expect(assertion.grant_type).toEqual(expectedAssertion.grant_type);
    expect(assertion.scope).toEqual(expectedAssertion.scope);

    done()

  });

  it('Can make authorization request for token with signed assertion', done => {

    let client = new Client(config);
    expect(client.apiGateway.defaults.headers.common['Authorization']).toBeUndefined();
    client.authorize().then(() => {
      expect(client.apiGateway.defaults.headers.common['Authorization']).toEqual("Bearer FAKE_BEAER_TOKEN");
      done()

    });
  });


  it('Can make requests to post message to infrasturcutre', done => {
    let client = new Client(config);
    client.authorize().then((te) => {
      client.processMessage("Message").then((ret) => {
        expect(ret.data).toEqual(fakeRepsonse);
        done();
      })
    });
  });

});