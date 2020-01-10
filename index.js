#!/usr/bin/env node

const program = require('commander');
const {Client} = require('./src/Client');

let input;
program
    .name('icaredata-client')
    .usage('<path-to-messages> [options]')
    .option(
        '-i, --identity-file <identityFilePath>',
        'the path to the private jwk',
    )
    .option('-c, --client-id <clientId>', 'the client id')
    .arguments('<path-to-messages>')
    .action(function(pathToMessages) {
      input = pathToMessages;
    })
    .parse(process.argv);

const identityFilePath = program.identityFile || process.env.ICD_PRIVATE_JWK;
const clientId = program.clientId || process.env.ICD_CLIENT_ID;

try {
  const client = new Client(input, identityFilePath, clientId);
  client.send();
} catch (e) {
  console.error(e);
  program.help();
}
