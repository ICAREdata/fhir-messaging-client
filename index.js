#!/usr/bin/env node

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const program = require('commander');

let input;

program
    .name('icaredata-client')
    .usage('<path-to-messages> [options]')
    .option('-o, --out <out>', 'the path to the output folder', path.join('.', 'out'))
    .arguments('<path-to-messages>')
    .action(function (pathToMessages) {
        input = pathToMessages;
    })
    .parse(process.argv);

// Check that input folder is specified
if (!input) {
    console.error('Missing path to messages folder.');
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
const data = { config: null, messages: [] };
for (const file of files) {
    const fileContent = fs.readFileSync(path.join(input, file), 'utf8');
    if (fileContent) {
        if (file === 'config.json') {
            data.config = JSON.parse(fileContent);
        } else if (file.endsWith('.json')) {
            data.messages.push(fileContent);
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

const apiGateway = axios.create({
    baseURL: data.config.baseURL,
    timeout: data.config.timeout,
});

Promise.all(data.messages.map(message => {
    apiGateway.post('/DSTU2/$process-message', message)
    .then(r => console.log('Success'))
    .catch(e => console.error(e.message));
}));
