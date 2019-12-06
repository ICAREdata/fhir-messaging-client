# ICAREdata Client

## Installation

Once you have cloned or downloaded this repository, run

```bash
npm install
```

to install all necessary dependencies.

## Setup

In order to post FHIR Messages to the [ICAREdata platform](https://github.com/ICAREdata/icaredata-platform), you have to set up an input message directory on your local file system. This directory can have any name, but must contain a file named `config.json` with the following contents:

* A `baseURL` field that indicates the base URL of the server to post messages to, and
* A `timeout` field to indicate the time period in milliseconds to wait before the client times out.

If following the local setup instructions for the [ICAREdata platform](https://github.com/ICAREdata/icaredata-platform), you can use the following `config.json`:

```
{
    "baseURL": "http://127.0.0.1:3000",
    "timeout": 100000
}
```

The directory can then contain as many JSON files containing valid FHIR Messages as desired. It must contain at least one.

You will also need to create a jwk and register the public jwk with the OAuth server. 

## Execution

To post messages, enter the directory for this project, and then run

```bash
node . <path-to-messages-folder> -c <client-id> -i <path-to-private-jwk>
```

This will report success for each successful post, and will report the error message for any unsuccessful post.

Alternatively, you can set the `ICD_PRIVATE_JWK` and `ICD_CLIENT_ID` environment variables.
