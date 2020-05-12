#!/usr/bin/env node

const program = require('commander');
const Client = require('./src/Client.js');
const fs = require('fs');
const path = require('path');

function readConfigFile(configFile) {
  return JSON.parse(fs.readFileSync(configFile));
}

let input;
program
    .name('fhir-messaging-client')
    .usage('<path-to-messages> [options]')
    .option(
        '-c, --config <configFilePath>',
        'the path to the configuration file',
    )
    .arguments('<path-to-messages>')
    .action(function(pathToMessages) {
      input = pathToMessages;
    })
    .parse(process.argv);

// create a new client
// loop over directory of files
// collect results
try {
  const config = readConfigFile(program.config);
  const client = new Client(config);
  client.canSendMessage()
      .then((r) => {
        if (!r) {
          console.log(`The server does not provide the 'system/$process-message' scope.`);
          return;
        }
        client.authorize().then(() => {
          const files = fs.readdirSync(input, 'utf8');
          for (const file of files) {
            const filePath = path.join(input, file);
            if (fs.statSync(filePath).isDirectory()) continue;
            const fileContent = fs.readFileSync(filePath, 'utf8');
            if (fileContent) {
              if (file.endsWith('.json')) {
                client.processMessage(fileContent)
                    .then(() => console.log(`${file} - Success!`))
                    .catch((e) => {
                      const violation = JSON.parse(e.response.data.errorMessage);
                      const violationText = violation.entry[1].resource.issue.details.text;
                      console.error(`${file} - ${e.message} - ${violationText}`);
                    });
              }
            }
          }
        }).catch((e) => console.log(e));
      })
      .catch((e) => console.log(e));
} catch (e) {
  console.error(e);
  program.help();
};
