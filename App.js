var path = require('path');
var child_process = require('child_process');
var interpolateString = require('interpolate-string');
var mapValues = require('lodash.mapvalues');

class App {
	constructor(argument) {
		this.site;
		this.type = argument.type;
		this.module = argument.module;
		this.arguments = argument.arguments;
		this.cwd = argument.cwd;
		this.env = argument.env;
		this.port = argument.port;
		this.process;
		this._port;
	}
	async start(callback) {
		var { default: getPort } = await import('get-port');
		switch (this.type) {
			case 'middleware':
				var $this = this;
				try { var module = this.site.Module.resolve(this.module); }
				catch (e) { callback(e); return; }
				this.process = child_process.fork(
					path.join(__dirname, 'serveApp.js'), [
						"--module", module,
						"--arguments", JSON.stringify(this.arguments),
						...this.port ? ["--port", this.port] : []
					],
					{ silent: true }
				);
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
							callback({ _port: $this._port });
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
				var _port = $this.port || await getPort({
					exclude: Object.values(this.site.app).map(app => app.port).filter(Boolean)
				});
				this.process = child_process.fork(module, this.arguments.map(interpolate), {
					...this.cwd ? { cwd: path.resolve(this.site.config.dir, this.cwd) } : {},
					env: { ...process.env, ...mapValues(this.env, interpolate) },
					silent: true
				});
				this.process.on('spawn', function () {
					$this._port = _port;
					$this.process.on('exit', function () {
						delete $this._port;
						delete $this.process;
					});
					callback({ _port: $this._port });
				});
				this.process.on('error', function (e) {
					delete $this.process;
					callback(e);
				});
				break;
			case 'command':
				var $this = this;
				var _port = $this.port || await getPort({
					exclude: Object.values(this.site.app).map(app => app.port).filter(Boolean)
				});
				this.process = child_process.spawn(interpolate(this.module), this.arguments.map(interpolate), {
					...this.cwd ? { cwd: path.resolve(this.site.config.dir, this.cwd) } : {},
					env: { ...process.env, ...mapValues(this.env, interpolate) }
				});
				this.process.on('spawn', function () {
					$this._port = _port;
					$this.process.on('exit', function () {
						delete $this._port;
						delete $this.process;
					});
					callback({ _port: $this._port });
				});
				this.process.on('error', function (e) {
					delete $this.process;
					callback(e);
				});
				break;
		}
		function interpolate(s) {
			return interpolateString(s, { port: _port });
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
			case 'command':
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
