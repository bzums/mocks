var express = require('express'),
    server = express(),
    bodyParser = require('body-parser'),
    querystring = require('querystring'),
    uuid = require('node-uuid'),

    TOKENSTORE = {},
    PENDING_CONSENT = {},
    // ALLOWED_CLIENTS is an optional comma-separated string of valid client ids
    ALLOWED_CLIENTS = process.env.ENV_ALLOWED_CLIENTS ?
                        process.env.ENV_ALLOWED_CLIENTS.split(',') :
                        false;

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
            return false
        })
        .filter(function(token) {
            return !!token;
        })
        .forEach(function(token) {
            delete TOKENSTORE[token];
        });
}, 1000);

server.set('view engine', 'jade');
server.use(express.static('public'));
// to parse urlencoded body
server.use(bodyParser.urlencoded({
    extended: true
}));

// enable CORS for simplicity
server.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, HEAD, DEELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

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
        scopes: tokeninfo.scopes,
        expires_in: Math.floor((tokeninfo.expiration_date - Date.now()) / 1000)
    };
    res.status(200).send(response);
});

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
    res.redirect(301, consentRequest.redirect_uri + '#' + querystring.stringify(error));
});

server.post('/accept', function(req, res) {
    var state = req.body.state;
    if (!state) {
        res.render('error', {
            message: 'Unknown pending consent'
        });
        return;
    }
    var consentRequest = PENDING_CONSENT[state],
        token = uuid.v4(),
        expiration_date = Date.now() + 3600*1000,
        success = {
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600,
            state: state
        };
    TOKENSTORE[token] = {
        access_token: token,
        expiration_date: expiration_date,
        token_type: 'Bearer',
        scopes: req.body.scopes ? req.body.scopes.split(',') : []
    };
    delete PENDING_CONSENT[state];
    res.redirect(301, consentRequest.redirect_uri + '#' + querystring.stringify(success));
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

    // check mandatory fields
    if (!req.query.response_type || !client_id) {
        error = { error: 'invalid_request', state: req.query.state };
        res.redirect(301, req.query.redirect_uri + '#' + querystring.stringify(error));
        return;
    }
    // check client_id
    if (ALLOWED_CLIENTS !== false) {
        if (ALLOWED_CLIENTS.indexOf(client_id) < 0 ) {
            res.render('error', {
                message: 'Unknown or invalid client'
            });
            return;
        }
    }

    PENDING_CONSENT[req.query.state] = req.query;
    res.render('consent', {
        scopes: req.query.scopes ? req.query.scopes.split(' ') : [],
        state: req.query.state
    });
});

server.listen(process.env.PORT || 3000);