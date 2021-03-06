var path = require('path');
var child_process = require('child_process');

function App(argument) {
	this.site;
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
			try { var module = this.site.Module.resolve(this.module); }
			catch (e) { callback(e); return; }
			this.process = child_process.fork(path.join(__dirname, 'serveApp.js'), ["--module", module, "--arguments", JSON.stringify(this.arguments), ...this.port ? ["--port", this.port] : []]);
			this.process.send('start');
			this.process.once('message', function (message) {
				var [status, data] = message.split('\n');
				switch (status) {
					case 'succeed':
						$this._port = +data;
						$this.process.on('exit', function () {
							delete $this._port;
							delete $this.process;
						});
						callback.apply();
						break;
					case 'error':
						$this.process.kill();
						delete $this.process;
						callback(new Error(data));
						break;
				}
			});
			break;
		case 'standalone':
			var $this = this;
			try { var module = this.site.Module.resolve(this.module); }
			catch (e) { callback(e); return; }
			this.process = child_process.fork(module, this.arguments);
			this._port = this.port;
			this.process.on('exit', function () {
				delete $this._port;
				delete $this.process;
			});
			callback.apply();
			break;
	}
};
App.prototype.stop = function (callback) {
	switch (this.type) {
		case 'middleware':
			var $this = this;
			this.process.send('stop');
			this.process.once('message', function () {
				$this.process.kill();
				callback.call();
			});
			break;
		case 'standalone':
			this.process.kill();
			callback.call();
			break;
	}
};
Object.defineProperty(App.prototype, 'running', {
	get: function () { return this.process != undefined; }
});
module.exports = App;
