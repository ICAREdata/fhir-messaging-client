#!/usr/bin/env node

const program = require('commander');
const utils = require('../utils.js');
const fs = require('fs');

let input; let password; let output;
program
    .name('pkcs12 to jwk')
    .usage('<path-to-pk-file> <pass> <path-to-output-file>')
    .arguments('<path-to-pk-file> <pass> <path-to-output-file>')
    .action(function(pathToPkFile, pass, out) {
      input = pathToPkFile;
      password = pass;
      output = out;
    })
    .parse(process.argv);

try {
  utils.pkcs12ToJwk(input, password).then((jwk) => {
    console.log(jwk);
    fs.writeFileSync(output, JSON.stringify(jwk));
  });
} catch (e) {
  console.error(e);
  program.help();
};
