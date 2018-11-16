var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var basicAuth = require('express-basic-auth');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('http-proxy-rules');
var createServer = require('create-server');
var npm = require('global-npm');
var commander = require('commander');
var App = require('./App');
var Storage = require('./Storage');
var ProxyRules = require('./ProxyRules');
commander
	.option('--port <port>', undefined, Number)
	.option('--ssl')
	.option('--cert <cert>')
	.option('--key <key>')
	.option('--proxy-rules <proxy-rules>')
	.option('--proxy-options <proxy-options>')
	.option('--app <app>')
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
var proxyRules = new HttpProxyRules(
	commander.proxyRules ?
		JSON.parse(fs.readFileSync(commander.proxyRules, { encoding: "utf-8" })) :
		{ rules: {} }
);
var proxyRule = ProxyRules(proxyRules);
function matchApp(req) {
	var end = req.url.indexOf('/', 1);
	var name = end != -1 ? req.url.substring(1, end) : '';
	var a = app[name];
	if (a) if (a.port) {
		if (end != -1)
			req.url = req.url.substr(end);
		return `http://localhost:${a.port}`;
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
		res.status(p ? 200 : 201).end();
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
		res.status(a ? 200 : 201).end();
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
		a.start(() => {
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
				var [[, dir]] = data;
				var name = path.basename(dir);
				module[name] = req.body;
				res.status(201).end();
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
		running: app.running
	};
}
var adminServer = createServer(adminApp, commander.adminSsl ? serverOptions : undefined);
adminServer.listen(commander.adminPort);
var app = commander.app ? JSON.parse(fs.readFileSync(commander.app, { encoding: "utf-8" })) : {};
var module = Storage('./module.json');
for (var name in app)
	app[name] = new App(app[name]);
for (var name in app)
	app[name].start(() => { });
