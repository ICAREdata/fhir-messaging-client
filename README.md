# Fhir Messaging Client

The `fhir-messaging-client` repository contains a client through which a user can process FHIR Message Bundles by sending them to the ICAREdata infrastructure.

## Setting Up the Client

In order to post FHIR Messages to the ICAREdata infrastructure, you have to set up an input message directory on your local file system. This directory can have any name. The directory can then contain as many JSON files containing valid FHIR Messages as desired. It must contain at least one.

### Authentication

In addition, you must have a JSON configuration file on your local file system, ideally not in your input message directory. This configuration file will contain information associated with your client registration with the ICAREdata infrastructure's OAuth2 authentication framework.

* A `baseURL` field that indicates the base URL of the server to post messages to.
* A `clientId` field containing the client ID that is registered for the ICAREdata OAuth2 framework.
* An `aud` field containing the audience parameter that is registered for the client in the ICAREdata OAuth2 framework.
* And private-key information corresponding to the registered client in the ICAREdata OAuth2 framework, which can be provided in two formats:
  * A `jwk` field, containing a JWK-JSON object corresponding to, or;
  * Two fields - `pkcs12` and `pkcs12Pass` - where the former is a filepath to your locally saved PEMfile and the latter is the password for opening that file.

*NOTE* More detailed instructions will follow for how to register a client with the ICAREdata infrastructure in the future.

## Execution

To post messages, enter the directory for this project, and then run

```bash
node index.js <path-to-messages-folder> -c <config-file-path>
```

This will report success for each successful post, and will report the error message for any unsuccessful post.

## Local Dev Setup

The following instructions assume a MacOS development setup.

Install the [Homebrew](https://brew.sh/) package manager.

Use Homebrew in the command line to install `node` and `yarn`.

```bash
brew install node
brew install yarn
```

After installing these, `yarn` can be used to install all required dependencies for the code in this repository.

```bash
yarn install
```

## Run the Test Suite

To run the test suite for this repository, run the following command.

```bash
yarn test
```

# License

Copyright 2019, 2020 The MITRE Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
