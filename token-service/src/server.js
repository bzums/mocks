var express = require('express'),
    request = require('superagent'),
    OAUTH_AUTH_URL = process.env.OAUTH_AUTH_URL,
    OAUTH_CREDENTIALS = process.env.OAUTH_CREDENTIALS,
    server = express();

if (!OAUTH_AUTH_URL) {
    console.log('Missing URL to authorization server.');
    return;
}

if (!OAUTH_CREDENTIALS) {
    console.log('Missing OAuth credentials for authorization server.');
    return;
} else {
    OAUTH_CREDENTIALS = new Buffer(OAUTH_CREDENTIALS.split('=').join(':')).toString('base64');
}

server.get('/access_token', function(req, res) {
    request
        .post(OAUTH_AUTH_URL)
        .set('Authorization', 'Basic ' + OAUTH_CREDENTIALS)
        .query({
            scope: req.query.scope,
            grant_type: 'client_credentials'
        })
        .end(function(err, response) {
            if (err) {
                if (err.status === 401) {
                    // unauthorized
                    return res.status(401).send();
                }
                return res.status(500).send(err);
            }
            return req.query.json === 'true' ?
                    res.status(200).send(response.body) :
                    res.status(200).send(response.body.access_token);
        });
});

server.listen(3002);