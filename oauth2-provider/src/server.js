var express = require('express'),
    server = express(),
    bodyParser = require('body-parser'),
    basicAuth = require('basic-auth'),
    querystring = require('querystring'),
    uuid = require('node-uuid'),

    TOKENSTORE = {},
    PENDING_CONSENT = {},
    ACCESS_CODES = {},
    CLIENTS,
    USERS,
    DEFAULT_REALM;

// CLIENTS = <client_id>=<client_secret>,<client_id>=<client_secret>
if (!process.env.CLIENTS) {
    CLIENTS = false;
    console.log('Warning: You did not specify clients, so you can\'t do client credentials grant.');
} else {
    CLIENTS = process.env
                .CLIENTS
                .split(',')
                .map(function(client) {
                    var credentials = client.split('=');
                    if (credentials.length === 2) {
                        // provided secret
                        return {
                            id: credentials[0],
                            secret: credentials[1]
                        };
                    }
                    return {
                        id: credentials[0]
                    };
                });
}

// USERS = <uid1>=<password1>,<uid2>=<password2>
if (!process.env.USERS) {
    USERS = false;
    console.log('Warning: You did not specify users, so you can\'t do password grant.');
} else {
    USERS = process.env
                .USERS
                .split(',')
                .map(function(user) {
                    var credentials = user.split('=');
                    return {
                        username: credentials[0],
                        password: credentials[1]
                    };
                });
}

DEFAULT_REALM = process.env.DEFAULT_REALM || 'employees';

function generateAccessCode(client, realm, scopes) {
    var code = uuid.v4();
    ACCESS_CODES[code] = {
        client: client,
        realm: realm || DEFAULT_REALM,
        scopes: scopes || [],
        expiration_date: Date.now() + 10 * 1000 // better be quick!
    };
    return code;
}

function generateToken(uid, realm, scope) {
    var token = uuid.v4();
    TOKENSTORE[token] = {
        access_token: token,
        expiration_date: Date.now() + 3600 * 1000,
        token_type: 'Bearer',
        uid: uid,
        realm: realm || DEFAULT_REALM,
        scope: scope || []
    };
    return TOKENSTORE[token];
}

// cleanup job for tokens
setInterval(function() {
    var NOW = Date.now();
    Object
        .keys(TOKENSTORE)
        .filter(function(token) {
            var tokeninfo = TOKENSTORE[token];
            if (tokeninfo.expiration_date < NOW) {
                return token;
            }
            return false;
        })
        .filter(function(token) {
            return !!token;
        })
        .forEach(function(token) {
            delete TOKENSTORE[token];
        });
}, 1000);

// cleanup job for access codes
setInterval(function() {
    var NOW = Date.now();
    Object
    .keys(ACCESS_CODES)
    .filter(function(code) {
        if (ACCESS_CODES[code].expiration_date < NOW) {
            return code;
        }
        return false;
    })
    .filter(function(result) {
        return !!result;
    })
    .forEach(function(code) {
        delete ACCESS_CODES[code];
    });
}, 1000);

server.set('view engine', 'jade');
server.use(express.static('public'));
// to parse urlencoded body
server.use(bodyParser.urlencoded({
    extended: true
}));
server.use(bodyParser.json());

// enable CORS for simplicity
server.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, HEAD, DEELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});


function getAuth(request) {
    if (!request.headers.authorization && !request.body.client_id) {
        return false;
    }
    if (request.headers.authorization) {
        return basicAuth(request);
    }
    return { name: request.body.client_id, pass: request.body.client_secret };
}

/**
 * CLIENT CREDENTIALS FLOW
 */

function checkClientCredentials(req, res, next) {
    var authHeader = req.headers.authorization;
    if (!authHeader && !req.body.client_id) {
        return res.status(401).send();
    }
    var auth = getAuth(req);
    if (!auth || !auth.name) {
        return res.status(400).send();
    }
    if (CLIENTS) {
        if (CLIENTS.some(function(client) {
            return client.id === auth.name &&
                   client.secret === auth.pass;
        })) {
            next();
        } else {
            return res.status(401).send();
        }
    } else {
        next();
    }
}

server.post('/access_token', checkClientCredentials, function(req, res) {
    var grant_type = req.query.grant_type || req.body.grant_type;
    // only client_credentials, authorization_code and password are allowed
    if (['client_credentials', 'password', 'authorization_code'].indexOf(grant_type) < 0) {
        return res.status(400).send({
            error: 'invalid_request'
        });
    }
    var scope = req.query.scope || req.body.scope,
        scopes = scope ? scope.split(' ') : [],
        realm = req.query.realm || req.body.realm;

    if (grant_type === 'client_credentials') {
        var auth = getAuth(req),
            token = generateToken(auth.name, realm, scopes);
        res.status(200).send({
            access_token: token.access_token,
            expires_in: (token.expiration_date - Date.now()) / 1000,
            token_type: token.token_type
        });
    } else if (grant_type === 'password_grant') {
        // password grant
        var username = req.query.username || req.body.username,
            password = req.query.password || req.body.password,
            validCredentials =
                USERS.some(function(u) {
                    return u.username === username && u.password === password;
                });
        if (validCredentials) {
            var token = generateToken(username, realm, scopes);
            res.status(200).send({
                access_token: token.access_token,
                expires_in: (token.expiration_date - Date.now()) / 1000,
                token_type: token.token_type
            });
        } else {
            res.status(401).send();
        }
    } else if (grant_type === 'authorization_code') {
        var code = req.body.code,
            auth = getAuth(req),
            client = ACCESS_CODES[code].client,
            realm = ACCESS_CODES[code].realm,
            scopes = ACCESS_CODES[code].scopes,
            redirect = req.body.redirect_uri;
        if (ACCESS_CODES[code] && client === auth.name) {
            //FIXME
            var token = generateToken('__ANON__', realm, scopes);
            res.status(200).send({
                access_token: token.access_token,
                expires_in: (token.expiration_date - Date.now()) / 1000,
                token_type: token.token_type
            });
        } else {
            res.status(401).send();
        }
    }
});

/**
 * TOKENINFO ENDPOINT
 */

server.get('/tokeninfo', function(req,res) {
    var requestedToken = req.query.access_token;
    if (!requestedToken) {
        return res
                .status(400)
                .send({
                    error: 'invalid_request',
                    error_description: 'No token provided'
                });
    }
    // check that token exists
    if (!TOKENSTORE[requestedToken]) {
        return res
                .status(400)
                .send({
                    error: 'invalid_request',
                    error_description: 'Access token not valid'
                });
    }
    var tokeninfo = TOKENSTORE[requestedToken];
    // check expiry date
    if (tokeninfo.expiration_date <= Date.now()) {
        // invalid token
        return res
                .status(400)
                .send({
                    error: 'invalid_request',
                    error_description: 'Access token not valid'
                });
    }
    // token exists and is valid => success response
    var response = {
        access_token: tokeninfo.access_token,
        token_type: tokeninfo.token_type,
        scopes: tokeninfo.scope,
        uid: tokeninfo.uid,
        realm: tokeninfo.realm,
        expires_in: Math.floor((tokeninfo.expiration_date - Date.now()) / 1000)
    };
    res.status(200).send(response);
});

/**
 * IMPLICIT FLOW
 */

server.post('/decline', function(req, res) {
    var state = req.body.state;
    if (!state) {
        res.render('error', {
            message: 'Unknown pending consent'
        });
        return;
    }
    var consentRequest = PENDING_CONSENT[state],
        error = { error: 'access_denied', state: state};
    // return error
    res.redirect(302, consentRequest.redirect_uri + '#' + querystring.stringify(error));
});

server.post('/accept', function(req, res) {
    var state = req.body.state,
        type = req.body.type;
    if (!state) {
        res.render('error', {
            message: 'Unknown pending consent'
        });
        return;
    }
    var consentRequest = PENDING_CONSENT[state];
    if (type === 'token') {
        // send access token
        // FIXME make a login form, check credentials und use uid here
        var token = generateToken(null, null, req.body.scope ? req.body.scope.split(',') : []),
            success = {
                access_token: token.access_token,
                token_type: 'Bearer',
                expires_in: (token.expiration_date - Date.now()) / 1000,
                state: state
            };
        delete PENDING_CONSENT[state];
        return res.redirect(302, consentRequest.redirect_uri + '#' + querystring.stringify(success));
    } else if (type === 'code') {
        // send an access code
        var code = generateAccessCode(req.body.client, null, req.body.scope ? req.body.scope.split(',') : []);
        delete PENDING_CONSENT[state];
        return res.redirect(302, consentRequest.redirect_uri + '?' + querystring.stringify({
            code: code,
            state: state
        }));
    }
});

server.get('/authorize', function(req, res) {
    var client_id = req.query.client_id,
        error,
        success;

    // check redirect_uri
    if (!req.query.redirect_uri) {
        res.render('error', {
            message: 'Redirect URI missing'
        });
        return;
    }

    // check client_id
    if (CLIENTS !== false) {
        if (CLIENTS.map(function(c) { return c.id}).indexOf(client_id) < 0 ) {
            res.render('error', {
                message: 'Unknown or invalid client'
            });
            return;
        }
    }
    // check mandatory fields
    if (['token', 'code'].indexOf(req.query.response_type) < 0 || !client_id) {
        error = { error: 'invalid_request', state: req.query.state };
        res.redirect(302, req.query.redirect_uri + '#' + querystring.stringify(error));
        return;
    }

    PENDING_CONSENT[req.query.state] = req.query;
    res.render('consent', {
        scope: req.query.scope ? req.query.scope.split(' ') : [],
        state: req.query.state,
        type: req.query.response_type,
        client: client_id
    });
});

server.get('/status', function(req, res) {
   res.status(200).send("OK");
});

server.get('/', function(req, res) {
    res.redirect('/status');
});

server.listen(3000);
