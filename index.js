var http = require('http');
var https = require('https');
var fs = require('fs');
var express = require('express');
var commander = require('commander');
commander
	.option('--port <port>', undefined, Number)
	.option('--ssl')
	.option('--cert <cert>')
	.option('--key <key>');
commander.parse(process.argv);
var app = express();
var server =
	commander.ssl ?
		https.createServer({
			cert: fs.readFileSync(commander.cert),
			key: fs.readFileSync(commander.key)
		}, app) :
		http.createServer(app);
server.listen(commander.port || (commander.ssl ? 443 : 80));
