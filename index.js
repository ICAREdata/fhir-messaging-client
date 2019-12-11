#!/usr/bin/env node

const https = require('https');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const program = require('commander');
const uuidv4 = require('uuid/v4');
const {JWS} = require('node-jose');
const querystring = require('querystring');

let input;

program
    .name('icaredata-client')
    .usage('<path-to-messages> [options]')
    // .option('-o, --out <out>', 'the path to the output folder', path.join('.', 'out'))
    .option('-i, --identity-file <identityFilePath>', 'the path to the private jwk')
    .option('-c, --client-id <clientId>', 'the client id')
    .arguments('<path-to-messages>')
    .action(function(pathToMessages) {
      input = pathToMessages;
    })
    .parse(process.argv);

// Check that input folder is specified
if (!input) {
  console.error('Missing path to messages folder.');
  program.help();
}

// Check that a private jwk exists
const identityFilePath = program.identityFile || process.env.ICD_PRIVATE_JWK;
if (!identityFilePath) {
  console.error('Missing private JWK');
  program.help();
}

// Check that a client id exists
const clientId = program.clientId || process.env.ICD_CLIENT_ID;
if (!clientId) {
  console.log('Missing client ID');
  program.help();
}

// Try to parse the files from the input directory
let files;
try {
  files = fs.readdirSync(input, 'utf8');
} catch (e) {
  console.error('Invalid path to messages folder.');
  program.help();
}

// Collect the message files and the config file
const data = {config: null, messages: []};
for (const file of files) {
  const filePath = path.join(input, file);
  if (fs.statSync(filePath).isDirectory()) continue;
  const fileContent = fs.readFileSync(filePath, 'utf8');
  if (fileContent) {
    if (file === 'config.json') {
      data.config = JSON.parse(fileContent);
    } else if (file.endsWith('.json')) {
      data.messages.push({fileName: file, fileContent});
    }
  }
}

if (!data.config) {
  console.error('No config.json in messages folder.');
  program.help();
}

if (data.messages.length === 0) {
  console.error('No messages found in messages folder.');
  program.help();
}

let identityFile;
try {
  identityFile = require(identityFilePath);
} catch (e) {
  console.error('Invalid path to private JWK');
  program.help();
}

const apiGateway = axios.create({
  baseURL: data.config.baseURL,
  timeout: data.config.timeout,
});

const tokenEndpointPromise = apiGateway.get('/.well-known/smart-configuration')
    .then((r) => r.data.token_endpoint)
    .catch((e) => {
      console.error(`Request for token endpoint failed: ${e.message}`);
      program.help();
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
    kid: identityFile.kid,
    typ: 'JWT',
  },
};
const assertionPromise = tokenEndpointPromise
    .then((tokenEndpoint) => {
      const content = JSON.stringify({
        iss: clientId,
        sub: clientId,
        aud: tokenEndpoint,
        exp: Math.floor(Date.now()/1000) + 300,
        jti: uuidv4(),
      });
      return JWS.createSign(options, identityFile).update(content).final();
    })
    .catch((e) => {
      console.error(`Failed to create assertion: ${e.message}`);
      program.help();
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
      console.error(`Failed to obtain access token: ${e.message}`);
      program.help();
    });

const processMessage = (message, axiosInstance) => {
  axiosInstance.post('/DSTU2/$process-message', message.fileContent)
      .then((r) => console.log(`${message.fileName} - Success!`))
      .catch((e) => console.error(`${message.fileName} - ${e.message}`));
};
tokenPromise.then((token) => {
  apiGateway.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  for (const message of data.messages) {
    processMessage(message, apiGateway);
  }
});
