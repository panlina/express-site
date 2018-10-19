var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var basicAuth = require('express-basic-auth');
var expressJsonData = require('@kjots/express-json-data').default;
var httpProxy = require('http-proxy');
var HttpProxyRules = require('http-proxy-rules');
var createServer = require('create-server');
var commander = require('commander');
var App = require('./App');
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
var jsonBodyParser = bodyParser.json();
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
var app = express();
app.use(function (req, res, next) {
	var target = proxyRules.match(req);
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
	.use("/proxy-rules", expressJsonData({ data: proxyRules }))
	.get("/app/", (req, res, next) => {
		var json = {};
		for (var name in app)
			json[name] = serialize(app[name]);
		res.json(json);
	})
	.get("/app/:name", (req, res, next) => {
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		res.json(serialize(a));
	})
	.put("/app/:name", jsonBodyParser, (req, res, next) => {
		var a = app[req.params.name];
		if (a && a.server) {
			res.status(409).send("The app is running. Stop it and try again.");
			return;
		}
		app[req.params.name] = new App(req.body.module, req.body.arguments);
		res.status(a ? 200 : 201).end();
	})
	.delete("/app/:name", (req, res, next) => {
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (a.server) {
			res.status(409).send("The app is running. Stop it and try again.");
			return;
		}
		delete app[req.params.name];
		res.status(204).end();
	})
	.post("/app/:name/start", (req, res, next) => {
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (a.server) {
			res.status(409).send("The app is already running.");
			return;
		}
		start(req.params.name, () => {
			res.status(204).end();
		});
	})
	.post("/app/:name/stop", (req, res, next) => {
		var a = app[req.params.name];
		if (!a) {
			res.sendStatus(404);
			return;
		}
		if (!a.server) {
			res.status(409).send("The app is not running.");
			return;
		}
		stop(req.params.name, () => {
			res.status(204).end();
		});
	})
function serialize(app) {
	return {
		module: app.module,
		arguments: app.arguments,
		running: app.server != undefined
	};
}
var adminServer = createServer(adminApp, commander.adminSsl ? serverOptions : undefined);
adminServer.listen(commander.adminPort);
var app = commander.app ? JSON.parse(fs.readFileSync(commander.app, { encoding: "utf-8" })) : {};
for (var name in app)
	app[name] = new App(app[name].module, app[name].arguments);
for (var name in app)
	start(name, () => { });
function start(name, callback) {
	var a = app[name];
	a.start(commander.ssl ? serverOptions : undefined, function () {
		var protocol = commander.ssl ? 'https' : 'http',
			port = a.server.address().port;
		if (name)
			proxyRules.rules[`/${name}`] = `${protocol}://localhost:${port}`;
		else
			proxyRules.default = `${protocol}://localhost:${port}`;
		callback.apply(this, arguments);
	});
}
function stop(name, callback) {
	var a = app[name];
	a.stop(function () {
		if (name)
			delete proxyRules.rules[`/${name}`];
		else
			delete proxyRules.default;
		callback.apply(this, arguments);
	});
}
