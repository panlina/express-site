#!/usr/bin/env node

var commander = require('commander');
var Site = require('.');
commander
	.arguments('<dir>')
	.action(dir => { global.dir = dir; })
	.option('--port <port>', undefined, Number)
	.option('--ssl')
	.option('--cert <cert>')
	.option('--key <key>')
	.option('--admin-port <admin-port>', undefined, Number, 9000)
	.option('--admin-ssl');
commander.parse(process.argv);
var config = {
	dir: global.dir,
	port: commander.port,
	ssl: commander.ssl,
	cert: commander.cert,
	key: commander.key,
	adminPort: commander.adminPort,
	adminSsl: commander.adminSsl
};
new Site(config).start();
