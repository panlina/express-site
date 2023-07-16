var fs = require('fs');
var path = require('path');
var EventEmitter = require('events');
var http = require('http');
var https = require('https');
var cors = require('cors');
var basicAuth = require('express-basic-auth');
var Module = require('./Module');
var App = require('./App');
var ProxyApp = require('./ProxyApp');
var AdminApp = require('./AdminApp');
var Storage = require('./Storage');
class Site {
	constructor(config) {
		this.config = config;
		var $this = this;
		this.Module = Module(this);
		this.App = function (argument) {
			var app = new App(argument);
			app.site = $this;
			return app;
		};
	}
	start() {
		var config = this.config;
		if (config.cert && config.key)
			var serverOptions = {
				cert: fs.readFileSync(config.cert),
				key: fs.readFileSync(config.key)
			};
		if (!fs.existsSync(path.join(config.dir, 'require.resolve.js')))
			fs.writeFileSync(path.join(config.dir, 'require.resolve.js'), fs.readFileSync(path.join(__dirname, 'require.resolve.js')));
		var proxyRule = Storage(path.join(config.dir, 'proxyRule.json'));
		var vhost = Storage(path.join(config.dir, 'vhost.json'));
		var app = new ProxyApp(this, {
			proxyOptions: fs.existsSync(path.join(config.dir, 'proxyOptions.json')) ?
				JSON.parse(fs.readFileSync(path.join(config.dir, 'proxyOptions.json'), { encoding: "utf-8" })) :
				undefined,
			cors: cors(
				fs.existsSync(path.join(config.dir, 'cors.json')) ?
					JSON.parse(
						fs.readFileSync(path.join(config.dir, 'cors.json'), { encoding: "utf-8" })
					) :
					undefined
			)
		});
		var server = (config.ssl ? https : http).createServer(config.ssl ? serverOptions : undefined, app);
		server.listen(config.port);
		var eventEmitter = new EventEmitter();
		var adminApp = new AdminApp(this, {
			cors: this.config.adminCors ?
				cors(require('./adminCors.json')) :
				undefined,
			auth: fs.existsSync(path.join(config.dir, 'adminBasicAuth.json')) ?
				basicAuth(JSON.parse(fs.readFileSync(path.join(config.dir, 'adminBasicAuth.json'), { encoding: "utf-8" }))) : undefined
		});
		var adminServer = (config.adminSsl ? https : http).createServer(config.adminSsl ? serverOptions : undefined, adminApp);
		adminServer.listen(config.adminPort);
		var app = Storage(path.join(config.dir, 'app.json'), { constructor: this.App, destructor: app => ({ type: app.type, module: app.module, arguments: app.arguments, cwd: app.cwd, env: app.env, port: app.port }) });
		for (let name in app)
			app[name].start(e => {
				if (e instanceof Error) return;
				eventEmitter.emit('start', `/app/${encodeURIComponent(name || 'default')}`, e);
				app[name].process.on('exit', function (code, signal) {
					eventEmitter.emit('stop', `/app/${encodeURIComponent(name || 'default')}`, { code, signal });
				});
			});
		this.proxyRule = proxyRule;
		this.vhost = vhost;
		this.app = app;
		this.eventEmitter = eventEmitter;
		this.server = server;
		this.adminServer = adminServer;
	}
	stop() {
		for (var name in this.app)
			if (this.app[name].running)
				this.app[name].stop(() => { });
		this.server.close();
		this.adminServer.close();
	}
}
module.exports = Site;
