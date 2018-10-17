var express = require('express');
var createServer = require('create-server');

function App(module, arguments) {
	this.module = module;
	this.arguments = arguments;
}
App.prototype.start = function (options, callback) {
	var middleware = require(this.module).apply(undefined, this.arguments);
	var app = express().use(middleware);
	this.server = createServer(app, options);
	this.server.listen(0, callback);
};
App.prototype.stop = function (callback) {
	var $this = this;
	this.server.close(function () {
		delete $this.server;
		callback.apply(this, arguments);
	});
};

module.exports = App;
