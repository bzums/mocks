var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('superagent'),
    sqlite3 = require('sqlite3').verbose(),
    db = new sqlite3.Database(':memory:'),
    server = express(),
    OAUTH_TOKENINFO_URL = process.env.ENV_OAUTH_TOKENINFO_URL,
    OAUTH_ENABLED = !!OAUTH_TOKENINFO_URL;

process.on('exit', function() {
    db.close();
});

if (!process.env.ENV_USER_SOURCE) {
    console.log('Warning: No user source file specified!');
}

if (!process.env.ENV_TEAM_SOURCE) {
    console.log('Warning: No team source file specified!');
}

/**
 * READ FILES
 */
var userFile = String(fs.readFileSync(path.join(process.env.PWD, process.env.ENV_USER_SOURCE))),
    teamFile = String(fs.readFileSync(path.join(process.env.PWD, process.env.ENV_TEAM_SOURCE)));

/**
 * SETUP DB
 */

var SELECT_TEAM = 'SELECT team_id, account_id FROM teams WHERE team_id = ?;',
    SELECT_USER = 'SELECT u.uid, u.team_id, t.account_id ' +
                  'FROM teams t INNER JOIN users u ' +
                  'WHERE u.team_id=t.team_id AND u.uid=?;';

db.serialize(function() {
    db.run('CREATE TABLE users (uid TEXT PRIMARY KEY, team_id TEXT);');
    db.run('CREATE TABLE teams (team_id TEXT PRIMARY KEY, account_id TEXT);');

    // put users in user table
    var userStmt = db.prepare('INSERT INTO users VALUES (?, ?);');
    userFile
    .split('\n')
    .forEach(function(line) {
        var user = line.split(',');
        userStmt.run(user[0], user[1]);
    });

    // put teams in team table
    var teamStmt = db.prepare('INSERT INTO teams VALUES (?, ?);');
    teamFile
    .split('\n')
    .forEach(function(line) {
        var team = line.split(',');
        teamStmt.run(team[0], team[1]);
    });
});

/**
 * OAUTH MIDDLEWARE
 * TODO: Extract
 */

function oauth(tokeninfo_url) {
    function unauthorized(res, reason) {
        var body = reason ?
                    { error: reason } :
                    undefined;
        res
        .status(401)
        .send(body);
    }

    return function(req, res, next) {
        // check if auth header is present
        if (!req.headers.authorization) {
            //  => else 401
            return unauthorized(res);
        }
        // check if it has a token
        if (!req.headers.authorization.indexOf('Bearer ') === 0) {
            //  => else 401
            return unauthorized(res);
        }
        var token = req.headers.authorization.substring('Bearer '.length);
        // check if token is valid
        request
            .get(tokeninfo_url)
            .query({
                access_token: token
            })
            .end(function(err, response) {
                if (err) {
                    return unauthorized(res)
                }
                if (response.status === 200) {
                    next();
                } else {
                    return unauthorized(res, 'invalid_token');
                }
            });
    };
};

if (OAUTH_ENABLED) {
    console.log('OAuth enabled.');
    server.use(oauth(OAUTH_TOKENINFO_URL));
}

/**
 * API
 */

server.get('/teams', function(req, res) {
    db.all('SELECT team_id, account_id FROM teams;', function(err, rows) {
        if (err) {
            return res.status(500).send(err);
        }
        var result = rows.map(function(row) {
            return {
                id: row.team_id,
                name: row.team_id,
                'infrastructure-accounts': [{
                    id: row.account_id,
                    type: 'aws'
                }]
            };
        });
        return res.status(200).type('json').send(result);
    });
});

server.get('/teams/:team_id', function(req, res) {
    db.get(SELECT_TEAM, req.params.team_id, function(err, row) {
        if (err) {
            return res.status(500).send(err);
        }
        var result = {
            id: row.team_id,
            name: row.team_id,
            'infrastructure-accounts': [{
                id: row.account_id,
                type: 'aws'
            }]
        };
        return res.status(200).type('json').send(result);
    });
});

server.get('/users', function(req, res) {
    db.all('SELECT uid, team_id FROM users;', function(err, rows) {
        if (err) {
            return res.status(500).send(err);
        }
        return res.status(200).type('json').send(rows);
    });
});

server.get('/users/:uid', function(req, res) {
    db.get(SELECT_USER, req.params.uid, function(err, row) {
        if (err) {
            return res.status(500).send(err);
        }
        var result = [{
            id: row.team_id,
            name: row.team_id,
            'infrastructure-accounts': [{
                id: row.account_id,
                type: 'aws'
            }]
        }];
        return res.status(200).type('json').send(result);
    });
});

server.listen(3001);