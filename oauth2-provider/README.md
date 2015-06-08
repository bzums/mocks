# OAuth2 Authorization Server Mock

Supports Implicit and Client Credentials Grants.

## Usage

With node

    git checkout https://github.com/zalando-stups/mocks/tree/master/oauth2-provider
    cd oauth2-provider/src
    node server.js

With Docker

    docker run stups/mock-oauth2-provider

### Accepted environment variables

* `ENV_CLIENTS`: Comma-separated list of accepted client IDs and secrets, e.g. `"client1=secret1,client2=secret2"`.

## API

See [swagger.yml](swagger.yml).