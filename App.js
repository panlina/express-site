var child_process = require('child_process');

function App(argument) {
	this.type = argument.type;
	this.module = argument.module;
	this.arguments = argument.arguments;
	this.process;
	this.port;
}
App.prototype.start = function (callback) {
	switch (this.type) {
		case 'middleware':
			var $this = this;
			this.process = child_process.fork('serveApp.js', ["--module", this.module, "--arguments", JSON.stringify(this.arguments)]);
			this.process.send('start');
			this.process.on('message', function (message) {
				$this.port = message;
				callback.apply(this, arguments);
			});
			break;
		case 'standalone':
			this.process = child_process.fork(this.module, this.arguments);
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
				delete $this.port;
				$this.process.kill();
				delete $this.process;
				callback.call(this, arguments);
			});
			break;
		case 'standalone':
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
