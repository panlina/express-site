var express = require('express');
var createServer = require('create-server');
var commander = require('commander');
commander
	.option('--module <module>')
	.option('--arguments <arguments>', undefined, json => JSON.parse(json))
	.option('--port <port>', undefined, Number);
commander.parse(process.argv);
process.on('message', message => {
	switch (message) {
		case 'start':
			start(() => process.send(server.address().port));
			break;
		case 'stop':
			stop(() => process.send(null));
			break;
	}
});
var server;
function start(callback) {
	var middleware = require(commander.module).apply(undefined, commander.arguments);
	var app = express().use(middleware);
	server = createServer(app);
	server.listen(commander.port || 0, callback);
}
function stop(callback) {
	server.close(function () {
		server = undefined;
		callback.apply(this, arguments);
	});
}
