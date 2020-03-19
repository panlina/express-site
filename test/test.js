var assert = require('assert');
var http = require("http");
var request = require('request');
var Site = require('..');
var Module = require('../Module');
it('should start and stop', function (done) {
	var site = new Site({ dir: "test/site/" });
	site.start();
	var port = site.server.address().port;
	request.get(`http://localhost:${port}`, (error, response) => {
		assert(response);
		site.stop();
		request.get(`http://localhost:${port}`, (error, response) => {
			assert(error);
			done();
		});
	});
});
it('proxy should work', function (done) {
	var site = new Site({ dir: "test/site/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
	targetServer.listen(8008);
	request.put(`http://localhost:${adminPort}/proxy-rule/%2fa`, { json: true, body: "http://localhost:8008" }, (error, response) => {
		request.get(`http://localhost:${port}/a`, (error, response) => {
			assert(response);
			assert.equal(response.body, "42");
			targetServer.close();
			site.stop();
			done();
		});
	});
});
it('vhost should work', function (done) {
	var site = new Site({ dir: "test/site/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
	targetServer.listen(8008);
	request.put(`http://localhost:${adminPort}/vhost/a.localhost`, { json: true, body: "http://localhost:8008" }, (error, response) => {
		request.get(`http://127.0.0.1:${port}`, { headers: { "Host": `a.localhost:${port}` } }, (error, response) => {
			assert(response);
			assert.equal(response.body, "42");
			targetServer.close();
			site.stop();
			done();
		});
	});
});
it('app should work', function (done) {
	var site = new Site({ dir: "test/site/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var app = {
		"type": "standalone",
		"module": "./standalone.js",
		"arguments": [],
		"mount": "directory"
	};
	request.put(`http://localhost:${adminPort}/app/a`, { json: true, body: app }, (error, response) => {
		request.post(`http://localhost:${adminPort}/app/a/start`, (error, response) => {
			setTimeout(() => {
				request.get(`http://localhost:${port}/a`, (error, response) => {
					assert(response);
					assert.equal(response.body, "42");
					site.stop();
					done();
				});
			}, 100);
		});
	});
});
it('module should work', function (done) {
	this.timeout(10000);
	var site = new Site({ dir: "test/site/" });
	site.start();
	var adminPort = site.adminServer.address().port;
	request.post(`http://localhost:${adminPort}/module/`, { json: true, body: { source: "./a" } }, (error, response) => {
		var module = site.Module.resolve("site:a");
		assert.equal(require(module), 42);
		site.stop();
		done();
	});
});
