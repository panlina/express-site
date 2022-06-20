var path = require('path');
var child_process = require('child_process');

class App {
	constructor(argument) {
		this.site;
		this.type = argument.type;
		this.module = argument.module;
		this.arguments = argument.arguments;
		this.cwd = argument.cwd;
		this.env = argument.env;
		this.shell = argument.shell;
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
				this.process = child_process.fork(
					path.join(__dirname, 'serveApp.js'), [
						"--module", module,
						"--arguments", JSON.stringify(this.arguments),
						...this.port ? ["--port", this.port] : []
					]
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
				this.process = child_process.fork(module, this.arguments, {
					...this.cwd ? { cwd: path.resolve(this.site.config.dir, this.cwd) } : {},
					env: { ...process.env, ...this.env, EXPRESS_SITE_PORT: this.port }
				});
				this._port = this.port;
				this.process.on('exit', function () {
					delete $this._port;
					delete $this.process;
				});
				callback.apply();
				break;
			case 'command':
				var $this = this;
				this.process = child_process.spawn(this.module, this.arguments, {
					...this.cwd ? { cwd: path.resolve(this.site.config.dir, this.cwd) } : {},
					env: { ...process.env, ...this.env, EXPRESS_SITE_PORT: this.port },
					shell: this.shell
				});
				this._port = this.port;
				this.process.on('exit', function () {
					delete $this._port;
					delete $this.process;
				});
				callback.apply();
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
