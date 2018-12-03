var fs = require('fs');
var path = require('path');
var EventEmitter = require('events');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var basicAuth = require('express-basic-auth');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('./HttpProxyRules');
var createServer = require('create-server');
var npm = require('global-npm');
var commander = require('commander');
var App = require('./App');
var Storage = require('./Storage');
commander
	.option('--port <port>', undefined, Number)
	.option('--ssl')
	.option('--cert <cert>')
	.option('--key <key>')
	.option('--proxy-options <proxy-options>')
	.option('--admin-port <admin-port>', undefined, Number, 9000)
	.option('--admin-ssl')
	.option('--admin-cors <admin-cors>')
	.option('--admin-basic-auth <admin-basic-auth>');
commander.parse(process.argv);
if (commander.cert && commander.key)
	var serverOptions = {
		cert: fs.readFileSync(commander.cert),
		key: fs.readFileSync(commander.key)
	};
var jsonBodyParser = bodyParser.json({ strict: false });
var proxy = httpProxy.createProxyServer(
	commander.proxyOptions ?
		JSON.parse(fs.readFileSync(commander.proxyOptions, { encoding: "utf-8" })) :
		undefined
);
var proxyRule = Storage('./proxyRule.json');
var proxyRules = new HttpProxyRules(proxyRule);
function matchApp(req) {
	var end = req.url.indexOf('/', 1);
	var name = end != -1 ? req.url.substring(1, end) : '';
	var a = app[name];
	if (a) if (a._port) {
		if (end != -1)
			req.url = req.url.substr(end);
		return `http://localhost:${a._port}`;
	}
}
var app = express();
app.use(function (req, res, next) {
	var target = matchApp(req) || proxyRules.match(req);
	if (target)
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
			res.send(e);
		});
	else
		next();
});
var server = createServer(app, commander.ssl ? serverOptions : undefined);
server.listen(commander.port || (commander.ssl ? 443 : 80));
var adminApp = express();
if (commander.adminCors)
	adminApp
		.use(cors(JSON.parse(fs.readFileSync(commander.adminCors, { encoding: "utf-8" }))));
if (commander.adminBasicAuth)
	adminApp
		.use(basicAuth(JSON.parse(fs.readFileSync(commander.adminBasicAuth, { encoding: "utf-8" }))));
adminApp
	.get("/proxy-rule/", (req, res, next) => {
		res.json(proxyRule);
	})
	.get("/proxy-rule/:name", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var p = proxyRule[req.params.name];
		if (!p) {
			res.sendStatus(404);
			return;
		}
		res.json(p);
	})
	.put("/proxy-rule/:name", jsonBodyParser, (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var p = proxyRule[req.params.name];
		proxyRule[req.params.name] = req.body;
		res.status(p ? 200 : 201);
		if (!p)
			res.header('Location', `/proxy-rule/${encodeURIComponent(req.params.name || 'default')}`);
		res.end();
	})
	.delete("/proxy-rule/:name", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var p = proxyRule[req.params.name];
		if (!p) {
			res.sendStatus(404);
			return;
		}
		delete proxyRule[req.params.name];
		res.status(204).end();
	})
	.move("/proxy-rule/:name", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var p = proxyRule[req.params.name];
		if (!p) {
			res.sendStatus(404);
			return;
		}
		var destination = req.header('Destination');
		var destination = destination.substr("/proxy-rule/".length);
		var destination = decodeURIComponent(destination);
		if (destination == 'default') destination = '';
		var q = proxyRule[destination];
		if (q)
			if (req.header('Overwrite') == 'F') {
				res.status(412).end();
				return;
			}
		delete proxyRule[req.params.name];
		proxyRule[destination] = p;
		res.status(q ? 204 : 201).end();
	})
	.get("/app/", (req, res, next) => {
		var json = {};
		for (var name in app)
			json[name] = serialize(app[name]);
		res.json(json);
	})
	.get("/app/:name", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		res.json(serialize(a));
	})
	.put("/app/:name", jsonBodyParser, (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var a = app[req.params.name];
		if (a && a.running) {
			res.status(409).send("The app is running. Stop it and try again.");
			return;
		}
		app[req.params.name] = new App(req.body);
		res.status(a ? 200 : 201);
		if (!a)
			res.header('Location', `/app/${encodeURIComponent(req.params.name || 'default')}`);
		res.end();
	})
	.delete("/app/:name", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (a.running) {
			res.status(409).send("The app is running. Stop it and try again.");
			return;
		}
		delete app[req.params.name];
		res.status(204).end();
	})
	.post("/app/:name/start", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (a.running) {
			res.status(409).send("The app is already running.");
			return;
		}
		a.start(e => {
			if (e instanceof Error) {
				res.status(500).send(e.message).end();
				return;
			}
			eventEmitter.emit('start', `/app/${encodeURIComponent(req.params.name || 'default')}`);
			a.process.on('exit', (code, signal) => {
				eventEmitter.emit('stop', `/app/${encodeURIComponent(req.params.name || 'default')}`, { code, signal });
			});
			res.status(204).end();
		});
	})
	.post("/app/:name/stop", (req, res, next) => {
		if (req.params.name == 'default') req.params.name = '';
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (!a.running) {
			res.status(409).send("The app is not running.");
			return;
		}
		a.stop(() => {
			res.status(204).end();
		});
	})
	.get("/module/", (req, res, next) => {
		res.json(module);
	})
	.get("/module/:name", (req, res, next) => {
		var m = module[req.params.name];
		if (!m) {
			res.sendStatus(404);
			return;
		}
		res.json(m);
	})
	.post("/module/", jsonBodyParser, (req, res, next) => {
		npm.load({ prefix: "./site_modules" }, function (er) {
			if (er) {
				res.status(500).send(er);
				return;
			}
			npm.commands.install([req.body.source], function (er, data) {
				if (er) {
					res.status(500).send(er);
					return;
				}
				var [, dir] = data[data.length - 1];
				var name = path.basename(dir);
				module[name] = req.body;
				res.status(201).header('Location', `/module/${encodeURIComponent(name)}`).end();
			});
		});
	})
	.delete("/module/:name", jsonBodyParser, (req, res, next) => {
		var m = module[req.params.name];
		if (!m) {
			res.sendStatus(404);
			return;
		}
		npm.load({ prefix: "./site_modules" }, function (er) {
			if (er) {
				res.status(500).send(er);
				return;
			}
			npm.commands.uninstall([req.params.name], function (er) {
				if (er) {
					res.status(500).send(er);
					return;
				}
				delete module[req.params.name];
				res.status(204).end();
			});
		});
	})
function serialize(app) {
	return {
		type: app.type,
		module: app.module,
		arguments: app.arguments,
		port: app.port,
		running: app.running
	};
}
var eventEmitter = new EventEmitter();
adminApp
	.get("/event/", (req, res, next) => {
		res.writeHead(200, {
			"Content-Type": "text/event-stream"
		});
		listen('start');
		listen('stop');
		function listen(type) {
			eventEmitter.on(type, listener);
			res.on('close', () => { eventEmitter.removeListener(type, listener); });
			function listener(source, data) {
				res.write(`event: ${type}\n`);
				res.write(`data: ${source !== undefined ? source : ''}\n`);
				res.write(`data: ${data !== undefined ? JSON.stringify(data) : ''}\n\n`);
			}
		}
	})
var adminServer = createServer(adminApp, commander.adminSsl ? serverOptions : undefined);
adminServer.listen(commander.adminPort);
var app = Storage('./app.json', { constructor: App, destructor: app => ({ type: app.type, module: app.module, arguments: app.arguments, port: app.port }) });
var module = Storage('./module.json');
for (let name in app)
	app[name].start(e => {
		if (e instanceof Error) return;
		eventEmitter.emit('start', `/app/${encodeURIComponent(name || 'default')}`);
		app[name].process.on('exit', function (code, signal) {
			eventEmitter.emit('stop', `/app/${encodeURIComponent(name || 'default')}`, { code, signal });
		});
	});
