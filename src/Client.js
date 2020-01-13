const https = require('https');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const uuidv4 = require('uuid/v4');
const {JWS} = require('node-jose');
const querystring = require('querystring');

/**
 * A Client to be used to post Messages to a FHIR server after negotiating
 * authentication with an OAuth server.
 */
module.exports = class Client {
  /**
   * Create the Client.
   * @param {string} input The input path containing FHIR messages.
   * @param {string} identityFilePath The path to the private JWK.
   * @param {string} clientId The client id to use for authentication.
   */
  constructor(input, identityFilePath, clientId) {
    // Check that input folder is specified
    if (input) {
      this.input = input;
    } else {
      throw new Error('Missing path to messages folder.');
    }

    // Check that a private jwk exists
    if (identityFilePath) {
      try {
        this.identityFile = require(identityFilePath);
      } catch (e) {
        throw new Error(`Invalid path to private JWK: ${e}`);
      }
    } else {
      throw new Error('Missing private JWK.');
    }

    // Check that a client id exists
    if (clientId) {
      this.clientId = clientId;
    } else {
      throw new Error('Missing client ID.');
    }

    // Try to parse the files from the input directory.
    try {
      this.files = fs.readdirSync(this.input, 'utf8');
    } catch (e) {
      throw new Error(`Invalid path to messages folder: ${e}`);
    }

    // Collect the message files and the config file
    this.data = {config: null, messages: []};
    for (const file of files) {
      const filePath = path.join(this.input, file);
      if (fs.statSync(filePath).isDirectory()) continue;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent) {
        if (file === 'config.json') {
          this.data.config = JSON.parse(fileContent);
        } else if (file.endsWith('.json')) {
          this.data.messages.push({fileName: file, fileContent});
        }
      }
    }

    if (this.data.messages.length === 0) {
      throw new Error('No messages found in messages folder.');
    }

    if (!this.data.config) {
      throw new Error('No config.json in messages folder.');
    }

    if (!this.data.config.baseURL) {
      throw new Error('No baseURL specified in config.json.');
    }

    if (!this.data.config.timeout) {
      throw new Error('No timeout specified in config.json.');
    }

    this.apiGateway = axios.create({
      baseURL: this.data.config.baseURL,
      timeout: this.data.config.timeout,
    });
  }

  /**
   * Authenticate and send Messages to FHIR server.
   */
  send() {
    const tokenEndpointPromise = this.apiGateway.get(
        '/.well-known/smart-configuration',
    )
        .then((r) => r.data.token_endpoint)
        .catch((e) => {
          throw new Error(`Request for token endpoint failed: ${e.message}`);
        });

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Turn off ssl verification
    });

    const oauthPromise = tokenEndpointPromise
        .then((tokenEndpoint) => axios.create({
          httpsAgent,
          baseURL: tokenEndpoint,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }));

    const options = {
      compact: true,
      alg: 'RS256',
      fields: {
        kid: this.identityFile.kid,
        typ: 'JWT',
      },
    };

    const assertionPromise = tokenEndpointPromise
        .then((tokenEndpoint) => {
          const content = JSON.stringify({
            iss: this.clientId,
            sub: this.clientId,
            aud: tokenEndpoint,
            exp: Math.floor(Date.now()/1000) + 300,
            jti: uuidv4(),
          });
          return JWS.createSign(
              options,
              this.identityFile,
          ).update(content).final();
        })
        .catch((e) => {
          throw new Error(`Failed to create assertion: ${e.message}`);
        });

    const tokenPromise = Promise.all([assertionPromise, oauthPromise])
        .then(([assertion, oauth]) => {
          const body = querystring.stringify({
            client_assertion: assertion,
            client_assertion_type:
              'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            grant_type: 'client_credentials',
            scope: 'system/$process-message',
          });
          return oauth.post('', body);
        })
        .then((r) => r.data.access_token)
        .catch((e) => {
          throw new Error(`Failed to obtain access token: ${e.message}`);
        });

    tokenPromise.then((token) => {
      this.apiGateway.defaults.headers.common['Authorization'] =
          `Bearer ${token}`;

      for (const message of this.data.messages) {
        this.processMessage(message);
      }
    });
  }

  /**
   * Send a FHIR Message to FHIR server.
   * @param {object} message The FHIR Message to send
   */
  processMessage(message) {
    this.apiGateway.post('/DSTU2/$process-message', message.fileContent)
        .then((r) => console.log(`${message.fileName} - Success!`))
        .catch((e) => console.error(`${message.fileName} - ${e.message}`));
  };
};
