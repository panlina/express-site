var express = require('express');
var bodyParser = require('body-parser');
var jsonBodyParser = bodyParser.json({ strict: false });
function AdminApp(site, { cors, auth }) {
	var app = express();
	if (cors)
		app.use(cors);
	if (auth)
		app.use(auth);
	app
		.get("/proxy-rule/", (req, res, next) => {
			res.json(site.proxyRule);
		})
		.get("/proxy-rule/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var p = site.proxyRule[req.params.name];
			if (p == undefined) {
				res.sendStatus(404);
				return;
			}
			res.json(p);
		})
		.put("/proxy-rule/:name", jsonBodyParser, (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var p = site.proxyRule[req.params.name];
			site.proxyRule[req.params.name] = req.body;
			res.status(p != undefined ? 200 : 201);
			if (p == undefined)
				res.header('Location', `/proxy-rule/${encodeURIComponent(req.params.name || 'default')}`);
			res.end();
		})
		.delete("/proxy-rule/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var p = site.proxyRule[req.params.name];
			if (p == undefined) {
				res.sendStatus(404);
				return;
			}
			delete site.proxyRule[req.params.name];
			res.status(204).end();
		})
		.move("/proxy-rule/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var p = site.proxyRule[req.params.name];
			if (p == undefined) {
				res.sendStatus(404);
				return;
			}
			var destination = req.header('Destination');
			var destination = destination.substr("/proxy-rule/".length);
			var destination = decodeURIComponent(destination);
			if (destination == 'default') destination = '';
			var q = site.proxyRule[destination];
			if (q != undefined)
				if (req.header('Overwrite') == 'F') {
					res.status(412).end();
					return;
				}
			delete site.proxyRule[req.params.name];
			site.proxyRule[destination] = p;
			res.status(q != undefined ? 204 : 201);
			if (q == undefined)
				res.header('Location', `/proxy-rule/${encodeURIComponent(destination || 'default')}`);
			res.end();
		})
		.get("/vhost/", (req, res, next) => {
			res.json(site.vhost);
		})
		.get("/vhost/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var h = site.vhost[req.params.name];
			if (h == undefined) {
				res.sendStatus(404);
				return;
			}
			res.json(h);
		})
		.put("/vhost/:name", jsonBodyParser, (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var h = site.vhost[req.params.name];
			site.vhost[req.params.name] = req.body;
			res.status(h != undefined ? 200 : 201);
			if (h == undefined)
				res.header('Location', `/vhost/${encodeURIComponent(req.params.name || 'default')}`);
			res.end();
		})
		.delete("/vhost/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var h = site.vhost[req.params.name];
			if (h == undefined) {
				res.sendStatus(404);
				return;
			}
			delete site.vhost[req.params.name];
			res.status(204).end();
		})
		.move("/vhost/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var h = site.vhost[req.params.name];
			if (h == undefined) {
				res.sendStatus(404);
				return;
			}
			var destination = req.header('Destination');
			var destination = destination.substr("/vhost/".length);
			var destination = decodeURIComponent(destination);
			if (destination == 'default') destination = '';
			var g = site.vhost[destination];
			if (g != undefined)
				if (req.header('Overwrite') == 'F') {
					res.status(412).end();
					return;
				}
			delete site.vhost[req.params.name];
			site.vhost[destination] = h;
			res.status(g != undefined ? 204 : 201);
			if (g == undefined)
				res.header('Location', `/vhost/${encodeURIComponent(destination || 'default')}`);
			res.end();
		})
		.get("/app/", (req, res, next) => {
			var json = {};
			for (var name in site.app)
				json[name] = serialize(site.app[name]);
			res.json(json);
		})
		.get("/app/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
			if (!a) {
				res.sendStatus(404);
				return;
			}
			res.json(serialize(a));
		})
		.put("/app/:name", jsonBodyParser, (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
			if (a && a.running) {
				res.status(409).send("The app is running. Stop it and try again.");
				return;
			}
			site.app[req.params.name] = new site.App(req.body);
			res.status(a ? 200 : 201);
			if (!a)
				res.header('Location', `/app/${encodeURIComponent(req.params.name || 'default')}`);
			res.end();
		})
		.delete("/app/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
			if (!a) {
				res.sendStatus(404);
				return;
			}
			if (a.running) {
				res.status(409).send("The app is running. Stop it and try again.");
				return;
			}
			delete site.app[req.params.name];
			res.status(204).end();
		})
		.move("/app/:name", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
			if (!a) {
				res.sendStatus(404);
				return;
			}
			var destination = req.header('Destination');
			var destination = destination.substr("/app/".length);
			var destination = decodeURIComponent(destination);
			if (destination == 'default') destination = '';
			var b = site.app[destination];
			if (b) {
				if (req.header('Overwrite') == 'F') {
					res.status(412).end();
					return;
				}
				if (b.running) {
					res.status(409).send("The app is running. Stop it and try again.");
					return;
				}
			}
			delete site.app[req.params.name];
			site.app[destination] = a;
			res.status(b ? 204 : 201);
			if (!b)
				res.header('Location', `/app/${encodeURIComponent(destination || 'default')}`);
			res.end();
		})
		.post("/app/:name/start", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
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
				site.eventEmitter.emit('start', `/app/${encodeURIComponent(req.params.name || 'default')}`, e);
				a.process.on('exit', (code, signal) => {
					site.eventEmitter.emit('stop', `/app/${encodeURIComponent(req.params.name || 'default')}`, { code, signal });
				});
				res.status(204).end();
			});
		})
		.post("/app/:name/stop", (req, res, next) => {
			if (req.params.name == 'default') req.params.name = '';
			var a = site.app[req.params.name];
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
	function serialize(app) {
		return {
			type: app.type,
			module: app.module,
			arguments: app.arguments,
			cwd: app.cwd,
			env: app.env,
			port: app.port,
			_port: app._port,
			running: app.running
		};
	}
	app
		.get("/event/", (req, res, next) => {
			res.writeHead(200, {
				"Content-Type": "text/event-stream"
			});
			listen('start');
			listen('stop');
			function listen(type) {
				site.eventEmitter.on(type, listener);
				res.on('close', () => { site.eventEmitter.removeListener(type, listener); });
				function listener(source, data) {
					res.write(`event: ${type}\n`);
					res.write(`data: ${source !== undefined ? source : ''}\n`);
					res.write(`data: ${data !== undefined ? JSON.stringify(data) : ''}\n\n`);
				}
			}
		})
	return app;
}
module.exports = AdminApp;
