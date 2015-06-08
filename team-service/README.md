# Team Service Mock

Knows users, their teams and the cloud accounts they have access to.

## Usage

The team service is accessible at port 3001.

With node

    git checkout https://github.com/zalando-stups/mocks/tree/master/team-service
    cd team-service/src
    node server.js

With Docker

    docker run stups/mock-team-service

For the docker client to be able to read the CSV files, you have to make them accessible via a volume:

    docker run -d -e ENV_USER_SOURCE=user.csv -e ENV_TEAM_SOURCE=team.csv -e ENV_DATA_DIR=/data -p 3001:3001 -v /data:<DATA_DIR> stups/mock-team-service

### Accepted environment variables

* `ENV_DATA_DIR` (required): Absolute path of a directory where user and team source (see next) are located.
* `ENV_USER_SOURCE` (required): Name of a CSV file where user and their team are listed
* `ENV_TEAM_SOURCE` (required): Name of a CSV file where the teams and their cloud account id are listed.
* `ENV_TOKENINFO_URL`: URL of /tokeninfo endpoint to check OAuth2 access tokens. If it's not present, requests will not be checked for tokens.

## File formats

### user.csv

    # user id, team id
    npiccolotto,stups
    test,stups
    iam,greendale

### team.csv

    # team id, description, cloud account id, dn
    stups,Cloud Engineers,84849249,some-dn
    greendale,Identity Managers,5813148535,other-dn

## API

See [swagger.yml](swagger.yml).