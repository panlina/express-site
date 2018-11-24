var child_process = require('child_process');
var Module = require('./Module');

function App(argument) {
	this.type = argument.type;
	this.module = argument.module;
	this.arguments = argument.arguments;
	this.port = argument.port;
	this.process;
	this._port;
}
App.prototype.start = function (callback) {
	switch (this.type) {
		case 'middleware':
			var $this = this;
			this.process = child_process.fork('serveApp.js', ["--module", Module.resolve(this.module), "--arguments", JSON.stringify(this.arguments), ...this.port ? ["--port", this.port] : []]);
			this.process.send('start');
			this.process.on('message', function (message) {
				$this._port = message;
				callback.apply(this, arguments);
			});
			break;
		case 'standalone':
			this.process = child_process.fork(Module.resolve(this.module), this.arguments);
			this._port = this.port;
			callback.apply(this, arguments);
			break;
	}
};
App.prototype.stop = function (callback) {
	switch (this.type) {
		case 'middleware':
			var $this = this;
			this.process.send('stop');
			this.process.on('message', function () {
				delete $this._port;
				$this.process.kill();
				delete $this.process;
				callback.call(this, arguments);
			});
			break;
		case 'standalone':
			delete this._port;
			this.process.kill();
			delete this.process;
			callback.call(this, arguments);
			break;
	}
};
Object.defineProperty(App.prototype, 'running', {
	get: function () { return this.process != undefined; }
});

module.exports = App;
