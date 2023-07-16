var express = require('express');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('./HttpProxyRules');
function App(site, { proxyOptions, cors }) {
	var proxy = httpProxy.createProxyServer(proxyOptions);
	function matchHost(req) {
		var host = req.header('Host');
		var [host, port] = host.split(':');
		return site.vhost[host];
	}
	var app = express();
	app.use(cors);
	app.use(function (req, res, next) {
		var proxyRules = new HttpProxyRules(site.proxyRule);
		var target = matchHost(req) || proxyRules.match(req);
		if (target) {
			if (target.startsWith('app:')) {
				var name = target.substr("app:".length);
				var a = site.app[name];
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
	return app;
}
module.exports = App;
