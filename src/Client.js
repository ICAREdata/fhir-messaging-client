const https = require('https');
const axios = require('axios');
const {v4} = require('uuid');
const querystring = require('querystring');
const utils = require('./utils');
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
    this.clientId = this.config.clientId;
    this.apiGateway = axios.create({
      baseURL: this.config.baseURL,
    });
  }

  async canSendMessage() {
    if (!this.config) {
      throw new Error(`FHIRMessagingClient config provided for client.`);
    }

    if (!this.config.baseURL) {
      throw new Error(`FHIRMessagingClient config does not contain a 'baseURL' field.`);
    }

    if (!this.config.clientId) {
      throw new Error(`FHIRMessagingClient config does not contain a 'clientId' field.`);
    }

    if (!this.config.aud) {
      throw new Error(`FHIRMessagingClient config does not contain an 'aud' field.`);
    }

    if (!(this.config.jwk || (this.config.pkcs12 && this.config.pkcs12Pass))) {
      throw new Error(
          `FHIRMessagingClient config does not contain a 'jwk' field or a 'pkcs12' and 'pkcs12Pass' field.`,
      );
    }

    const smartConfiguration =
      await this.apiGateway.get('/.well-known/smart-configuration')
          .then((r) => r);

    if (smartConfiguration && smartConfiguration.data) {
      const scopes = smartConfiguration.data.scopes_supported;
      if (Array.isArray(scopes)) {
        return scopes.includes('system/$process-message');
      }
    }

    throw new Error(`The server does not provide a well-known SMART configuration.`);
  }

  setBearerToken(token) {
    this.apiGateway.defaults.headers.common['Authorization'] =
      `Bearer ${token}`;
  }

  async getJWK() {
    if (this.config.jwk) {
      return this.config.jwk;
    } else if (this.config.pkcs12) {
      const jwk = await utils.pkcs12ToJwk(this.config.pkcs12, this.config.pkcs12Pass);
      this.config.jwk = jwk;
    }
    return this.config.jwk;
  }

  getTokenUrl() {
    return this.apiGateway.get(
        '/.well-known/smart-configuration',
    ).then((r) => r.data.token_endpoint);
  }

  async generateClientAssertion(tokenEndpoint, jti) {
    const jwk = await this.getJWK();
    const options = {
      compact: true,
      alg: 'RS384',
      fields: {
        kid: jwk.kid,
        typ: 'JWT',
      },
    };

    const content = JSON.stringify({
      iss: this.clientId,
      sub: this.clientId,
      aud: this.config.aud || tokenEndpoint,
      exp: Math.floor(Date.now() / 1000) + 300,
      jti: jti || v4(),
    });

    const assertion = await JWS.createSign(
        options,
        jwk,
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
        rejectUnauthorized: rejectUnauthorized, // Turn off ssl verification
      });

      return this.generateClientAssertion(tokenEndpoint).then((assertion) => {
        return axios.create({
          httpsAgent,
          baseURL: tokenEndpoint,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }).post('', querystring.stringify(assertion)).then((response) => {
          const json = ((typeof response.data) === 'string') ?
            JSON.parse(response.data) :
            response.data;
          this.setBearerToken(json.access_token);
        });
      });
    });
  }

  processMessage(message) {
    // TODO: hook some local validation in here
    return this.apiGateway.post('/$process-message', message);
  };
};
