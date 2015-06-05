# OAuth2 Authorization Server Mock

## Usage

With node

    git checkout https://github.com/zalando-stups/mocks/tree/master/oauth2-provider
    cd oauth2-provider
    node src/app.js

### Accepted environment variables

* `PORT`
* `ENV_ACCEPTED_CLIENTS`: Comma-separated list of accepted client IDs, e.g. `"test1,test2"`.