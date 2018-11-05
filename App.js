var child_process = require('child_process');

function App(module, arguments) {
	this.module = module;
	this.arguments = arguments;
	this.process;
	this.port;
}
App.prototype.start = function (callback) {
	var $this = this;
	this.process = child_process.fork('serveApp.js', ["--module", this.module, "--arguments", JSON.stringify(this.arguments)]);
	this.process.send('start');
	this.process.on('message', function (message) {
		$this.port = message;
		callback.apply(this, arguments);
	});
};
App.prototype.stop = function (callback) {
	var $this = this;
	this.process.send('stop');
	this.process.on('message', function () {
		delete $this.port;
		$this.process.kill();
		delete $this.process;
		callback.call(this, arguments);
	});
};
Object.defineProperty(App.prototype, 'running', {
	get: function () { return this.process != undefined; }
});

module.exports = App;
