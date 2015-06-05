var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    server = express();

if (!process.env.ENV_USER_SOURCE) {
    console.log('Warning: No user source file specified!');
}

if (!process.env.ENV_TEAM_SOURCE) {
    console.log('Warning: No team source file specified!');
}

var userFile = fs.readFileSync(path.join(process.env.PWD, process.env.ENV_USER_SOURCE)),
    teamFile = fs.readFileSync(path.join(process.env.PWD, process.env.ENV_TEAM_SOURCE));

console.log(String(userFile));
console.log(String(teamFile));

// continue from here