var express = require('express'),
    request = require('superagent'),
    basicAuth = require('basic-auth'),
    OAUTH_AUTH_URL = process.env.ENV_OAUTH_AUTH_URL,
    server = express();

if (!OAUTH_AUTH_URL) {
    console.log('Missing URL to authorization server.');
    return;
}

function ensureBasicAuth(req, res, next) {
    var authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send();
    }
    var auth = basicAuth(req);
    if (!auth || !auth.name || !auth.pass) {
        return res.status(400).send();
    }
    next();
}

server.use(ensureBasicAuth);

server.get('/access_token', function(req, res) {
    request
        .post(OAUTH_AUTH_URL)
        .set('Authorization', req.headers.authorization)
        .query({
            scope: req.query.scope,
            grant_type: 'client_credentials'
        })
        .end(function(err, response) {
            if (err) {
                return res.status(500).send(err);
            }
            return res.status(200).send(response.body);
        });
});

server.listen(3002);