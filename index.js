var http = require('http');
var https = require('https');
var fs = require('fs');
var express = require('express');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('http-proxy-rules');
var commander = require('commander');
commander
	.option('--port <port>', undefined, Number)
	.option('--ssl')
	.option('--cert <cert>')
	.option('--key <key>')
	.option('--proxy-rules <proxy-rules>')
	.option('--proxy-options <proxy-options>');
commander.parse(process.argv);
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
		proxy.web(req, res, { target: target });
	else
		next();
});
var server =
	commander.ssl ?
		https.createServer({
			cert: fs.readFileSync(commander.cert),
			key: fs.readFileSync(commander.key)
		}, app) :
		http.createServer(app);
server.listen(commander.port || (commander.ssl ? 443 : 80));
