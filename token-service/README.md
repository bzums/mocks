# Token Service Mock

Retrieves a token from the OAuth2 Authorization Server (mock) using client credentials grant.

## Usage

With node

    git checkout https://github.com/zalando-stups/mocks/tree/master/token-service
    cd token-service/src
    node app.js

With Docker

    docker run stups/mock-token-service

### Accepted environment variables

* `ENV_OAUTH_AUTH_URL` (required): URL of the `access_token` endpoint of the authorization server.
* `ENV_OAUTH_CREDENTIALS` (required): Client ID and secret to use at authorization server in the format "id=secret".

## API

See [swagger.yml](swagger.yml).