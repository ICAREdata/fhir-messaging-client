const https = require('https');
const axios = require('axios');
const uuidv4 = require('uuid/v4');
const {
  JWS,
} = require('node-jose');

/**
 * A Client to be used to post Messages to a FHIR server after negotiating
 * authentication with an OAuth server.
 */
module.exports = class Client {
  constructor(config) {
    this.config = config;
    this.jwk = this.config.jwk;
    this.clientId = this.config.clientId;

    this.apiGateway = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });
  }

  setBearerToken(token) {
    this.apiGateway.defaults.headers.common['Authorization'] =
      `Bearer ${token}`;

    console.log(this.apiGateway.defaults.headers.common['Authorization']);
  }

  getTokenUrl() {
    return this.apiGateway.get(
        '/.well-known/smart-configuration',
    ).then((r) => r.data.token_endpoint);
  }


  generateClientAssertion(tokenEndpoint, jti) {
    const options = {
      compact: true,
      alg: 'RS384',
      fields: {
        kid: this.jwk.kid,
        typ: 'JWT',
      },
    };

    const content = JSON.stringify({
      iss: this.clientId,
      sub: this.clientId,
      aud: tokenEndpoint,
      exp: Math.floor(Date.now() / 1000) + 300,
      jti: jti || uuidv4(),
    });

    const assertion = JWS.createSign(
        options,
        this.jwk,
    ).update(content).final();

    return {
      client_assertion: assertion,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      grant_type: 'client_credentials',
      scope: 'system/$process-message',
    };
  }

  async authorize() {
    await this.getTokenUrl().then((tokenEndpoint) => {
      let rejectUnauthorized = false;
      if (this.config.ssl_strict == false) {
        rejectUnauthorized = true;
      }
      const httpsAgent = new https.Agent({
        rejectUnauthorized, // Turn off ssl verification
      });
      const assertion = this.generateClientAssertion(tokenEndpoint);
      return axios.create({
        httpsAgent,
        baseURL: tokenEndpoint,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).post('', assertion).then((response) => {
        this.setBearerToken(response.data.access_token);
      });
    });
  }

  processMessage(message) {
    // TODO: hook some local validation in here
    return this.apiGateway.post('/R4/$process-message', message);
  };
};
