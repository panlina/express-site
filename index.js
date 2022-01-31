var fs = require('fs');
var path = require('path');
var EventEmitter = require('events');
var express = require('express');
var cors = require('cors');
var basicAuth = require('express-basic-auth');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('./HttpProxyRules');
var createServer = require('create-server');
var Module = require('./Module');
var App = require('./App');
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
		var proxy = httpProxy.createProxyServer(
			fs.existsSync(path.join(config.dir, 'proxyOptions.json')) ?
				JSON.parse(fs.readFileSync(path.join(config.dir, 'proxyOptions.json'), { encoding: "utf-8" })) :
				undefined
		);
		var proxyRule = Storage(path.join(config.dir, 'proxyRule.json'));
		var proxyRules = new HttpProxyRules(proxyRule);
		var vhost = Storage(path.join(config.dir, 'vhost.json'));
		function matchHost(req) {
			var host = req.header('Host');
			var [host, port] = host.split(':');
			return vhost[host];
		}
		var app = express();
		app.use(
			cors(
				fs.existsSync(path.join(config.dir, 'cors.json')) ?
					JSON.parse(
						fs.readFileSync(path.join(config.dir, 'cors.json'), { encoding: "utf-8" })
					) :
					undefined
			)
		);
		app.use(function (req, res, next) {
			var target = matchHost(req) || proxyRules.match(req);
			if (target) {
				if (target.startsWith('site:')) {
					var name = target.substr("site:".length);
					var a = app[name];
					if (a && a._port)
						target = `http://localhost:${a._port}`;
					else {
						res.status(404)
							.contentType('text/plain')
							.send("App not found.");
						return;
					}
				}
				proxy.web(req, res, { target: target }, function (e) {
					switch (e.code) {
						case "ENOTFOUND":
							res.status(404);
							break;
						case "ECONNREFUSED":
							res.status(502);
							break;
						case "ETIMEDOUT":
							res.status(504);
							break;
						default:
							res.status(500);
					}
					res.contentType('text/plain').send(e.message);
				});
			}
			else
				next();
		});
		var server = createServer(app, config.ssl ? serverOptions : undefined);
		server.listen(config.port);
		var eventEmitter = new EventEmitter();
		var adminApp = new AdminApp(this, {
			cors: this.config.cors ?
				cors(require('./adminCors.json')) :
				undefined,
			auth: fs.existsSync(path.join(config.dir, 'adminBasicAuth.json')) ?
				basicAuth(JSON.parse(fs.readFileSync(path.join(config.dir, 'adminBasicAuth.json'), { encoding: "utf-8" }))) : undefined
		});
		var adminServer = createServer(adminApp, config.adminSsl ? serverOptions : undefined);
		adminServer.listen(config.adminPort);
		var app = Storage(path.join(config.dir, 'app.json'), { constructor: this.App, destructor: app => ({ type: app.type, module: app.module, arguments: app.arguments, port: app.port }) });
		var module = Storage(path.join(config.dir, 'module.json'));
		for (let name in app)
			app[name].start(e => {
				if (e instanceof Error) return;
				eventEmitter.emit('start', `/app/${encodeURIComponent(name || 'default')}`);
				app[name].process.on('exit', function (code, signal) {
					eventEmitter.emit('stop', `/app/${encodeURIComponent(name || 'default')}`, { code, signal });
				});
			});
		this.proxyRule = proxyRule;
		this.vhost = vhost;
		this.app = app;
		this.module = module;
		this.eventEmitter = eventEmitter;
		this.server = server;
		this.adminServer = adminServer;
	}
	stop() {
		for (var name in this.app)
			this.app[name].stop(() => { });
		this.server.close();
		this.adminServer.close();
	}
}
module.exports = Site;
