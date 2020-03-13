const Client = require('../client');
const config = require('./config.json');
const nock = require('nock');
const pkcs12JWK = require('./pkcs12JWK.json');
const wellKnown = {
  'token_endpoint': 'http://localhost/token',
  'token_endpoint_auth_methods_supported': ['private_key_jwt'],
  'token_endpoint_auth_signing_alg_values_supported': ['RS384', 'ES384'],
  'scopes_supported': ['system/$process-message'],
};

const fakeResponse = {'resourceType': 'Bundle'};
describe('Client', () => {
  beforeEach(() => {
    const scope = nock('http://localhost')
        .get('/.well-known/smart-configuration')
        .reply(200, wellKnown);
    scope.post('/token').reply(200, '{\"access_token\": \"FAKE_BEARER_TOKEN\"}');
    scope.post('/$process-message').reply(200, fakeResponse);
  });


  it('Can retrieve well known endpoint to configure itself', (done) => {
    const client = new Client(config);
    client.getTokenUrl().then((te) => {
      expect(te == wellKnown.token_endpoint);
      done(te != wellKnown.token_endpoint);
    });
  });

  it('Can generate jwk from pkcs12 file', (done) => {
    const client = new Client({pkcs12: './src/__test__/keystore.p12', pkcs12Pass: 'test'});
    client.getJWK().then((jwk) => {
      expect(jwk).toEqual(pkcs12JWK);
      done();
    })
  });

  it('Can generate a signedRequest', (done) => {
    const expectedAssertion = {
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      grant_type: 'client_credentials',
      scope: 'system/$process-message',
    };

    const client = new Client(config);
    client.generateClientAssertion(wellKnown.token_endpoint, 1).then((assertion) => {
      expect(assertion);
      expect(assertion.client_assertion_type);
      expect(assertion.client_assertion_type).toEqual(
          expectedAssertion.client_assertion_type,
      );
      expect(assertion.grant_type).toEqual(expectedAssertion.grant_type);
      expect(assertion.scope).toEqual(expectedAssertion.scope);

      done();
    });
  });

  it('Can make authorization request for token with signed assertion', (done) => {
    const client = new Client(config);
    expect(client.apiGateway.defaults.headers.common['Authorization']).toBeUndefined();
    client.authorize().then(() => {
      expect(
          client.apiGateway.defaults.headers.common['Authorization'],
      ).toEqual('Bearer FAKE_BEARER_TOKEN');
      done();
    });
  });


  it('Can make requests to post message to infrastructure', (done) => {
    const client = new Client(config);
    client.authorize().then(() => {
      client.processMessage('Message').then((ret) => {
        expect(ret.data).toEqual(fakeResponse);
        done();
      });
    });
  });
});
