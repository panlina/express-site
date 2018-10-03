var http = require('http');
var express = require('express');
var commander = require('commander');
commander.option('--port <port>', undefined, Number, 80);
commander.parse(process.argv);
var app = express();
var server = http.createServer(app);
server.listen(commander.port);
