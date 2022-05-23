var http = require('http');
var express = require('express');
var commander = require('commander');
commander
	.option('--module <module>')
	.option('--arguments <arguments>', undefined, json => JSON.parse(json))
	.option('--port <port>', undefined, Number);
commander.parse(process.argv);
process.on('message', message => {
	switch (message) {
		case 'start':
			start(argument => {
				if (argument instanceof Error)
					process.send(`error\n${argument.message}`);
				else
					process.send(`succeed\n${server.address().port}`);
			});
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
	server = http.createServer(app);
	server.listen(commander.port || 0, callback);
	server.once('error', callback);
}
function stop(callback) {
	server.close(function () {
		server = undefined;
		callback.apply(this, arguments);
	});
}
