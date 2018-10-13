var express = require('express');
var createServer = require('create-server');

function App(module, arguments) {
	this.module = module;
	this.arguments = arguments;
}
App.prototype.start = function (options) {
	var middleware = require(this.module).apply(undefined, this.arguments);
	var app = express().use(middleware);
	this.server = createServer(app, options);
	this.server.listen(0);
};
App.prototype.stop = function () {
	this.server.close();
	delete this.server;
};

module.exports = App;
