var assert = require('assert');
var http = require("http");
var request = require('request');
var ncp = require('ncp');
var rimraf = require('rimraf');
var Site = require('..');
beforeEach(done => { ncp('test/site', 'test/site0', done); });
afterEach(done => { rimraf('test/site0', done); });
it('should start and stop', function (done) {
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	request.get(`http://localhost:${port}`, (error, response) => {
		assert(response);
		request.get(`http://localhost:${adminPort}`, (error, response) => {
			assert(response);
			site.stop();
			request.get(`http://localhost:${port}`, (error, response) => {
				assert(error);
				request.get(`http://localhost:${adminPort}`, (error, response) => {
					assert(error);
					done();
				});
			});
		});
	});
});
it('proxy should work', function (done) {
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
	targetServer.listen(8008);
	request.put(`http://localhost:${adminPort}/proxy-rule/%2fa`, { json: true, body: "http://localhost:8008" }, (error, response) => {
		assert.equal(response.statusCode, 201);
		request.get(`http://localhost:${port}/a`, (error, response) => {
			assert.equal(response.body, "42");
			request.delete(`http://localhost:${adminPort}/proxy-rule/%2fa`, (error, response) => {
				assert.equal(response.statusCode, 204);
				request.get(`http://localhost:${port}/a`, (error, response) => {
					assert.equal(response.statusCode, 404);
					targetServer.close();
					site.stop();
					done();
				});
			});
		});
	});
});
it('vhost should work', function (done) {
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
	targetServer.listen(8008);
	request.put(`http://localhost:${adminPort}/vhost/a.localhost`, { json: true, body: "http://localhost:8008" }, (error, response) => {
		assert.equal(response.statusCode, 201);
		request.get(`http://127.0.0.1:${port}`, { headers: { "Host": `a.localhost:${port}` } }, (error, response) => {
			assert.equal(response.body, "42");
			request.delete(`http://localhost:${adminPort}/vhost/a.localhost`, (error, response) => {
				assert.equal(response.statusCode, 204);
				request.get(`http://127.0.0.1:${port}`, { headers: { "Host": `a.localhost:${port}` } }, (error, response) => {
					assert.equal(response.statusCode, 404);
					targetServer.close();
					site.stop();
					done();
				});
			});
		});
	});
});
it('app should work', function (done) {
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	var app = {
		"type": "standalone",
		"module": "./standalone.js",
		"arguments": [],
		"port": 8008
	};
	request.put(`http://localhost:${adminPort}/app/a`, { json: true, body: app }, (error, response) => {
		assert.equal(response.statusCode, 201);
		request.post(`http://localhost:${adminPort}/app/a/start`, (error, response) => {
			assert.equal(response.statusCode, 204);
			request.put(`http://localhost:${adminPort}/proxy-rule/%2fa`, { json: true, body: "app:a" }, (error, response) => {
				assert.equal(response.statusCode, 201);
				setTimeout(() => {
					request.get(`http://localhost:${port}/a`, (error, response) => {
						assert.equal(response.body, "42");
						request.post(`http://localhost:${adminPort}/app/a/stop`, (error, response) => {
							assert.equal(response.statusCode, 204);
							setTimeout(() => {
								request.delete(`http://localhost:${adminPort}/app/a`, (error, response) => {
									assert.equal(response.statusCode, 204);
									request.get(`http://localhost:${port}/a`, (error, response) => {
										assert.equal(response.statusCode, 404);
										site.stop();
										done();
									});
								});
							}, 100);
						});
					});
				}, 100);
			});
		});
	});
});
it('module should work', function (done) {
	this.timeout(10000);
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var adminPort = site.adminServer.address().port;
	request.post(`http://localhost:${adminPort}/module/`, { json: true, body: { source: "./a" } }, (error, response) => {
		assert.equal(response.statusCode, 201);
		request.get(`http://localhost:${adminPort}/module/a`, { json: true }, (error, response) => {
			assert.deepEqual(response.body, { source: "./a" });
			request.delete(`http://localhost:${adminPort}/module/a`, (error, response) => {
				assert.equal(response.statusCode, 204);
				request.get(`http://localhost:${adminPort}/module/a`, (error, response) => {
					assert.equal(response.statusCode, 404);
					site.stop();
					done();
				});
			});
		});
	});
});
