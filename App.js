var path = require('path');
var child_process = require('child_process');

class App {
	constructor(argument) {
		this.site;
		this.type = argument.type;
		this.module = argument.module;
		this.arguments = argument.arguments;
		this.port = argument.port;
		this.process;
		this._port;
	}
	start(callback) {
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
			case 'npm-start':
				var $this = this;
				try {
					// https://stackoverflow.com/a/44315152/4127811
					var module = path.dirname(this.site.Module.resolve(joinPathUnnormalized(this.module, 'package.json')));
				}
				catch (e) { callback(e); return; }
				this.process = child_process.spawn("npm", ["start",
					...this.arguments.length ?
						["--", ...this.arguments] :
						[]
				], { cwd: module });
				this._port = this.port;
				this.process.on('exit', function () {
					delete $this._port;
					delete $this.process;
				});
				callback.apply();
				function joinPathUnnormalized() {
					var p = path.join.apply(path, arguments);
					if (arguments[0].startsWith('./'))
						p = './' + p;
					return p;
				}
				break;
		}
	}
	stop(callback) {
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
			case 'npm-start':
				this.process.kill();
				callback.call();
				break;
		}
	}
	get running() {
		return this.process != undefined;
	}
}
module.exports = App;
