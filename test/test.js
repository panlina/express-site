var assert = require('assert');
var http = require("http");
var assertThrows = require('assert-throws-async');
var request = require('request-promise').defaults({ resolveWithFullResponse: true, simple: false });
var { waitFor } = require('poll-until-promise');
var ncp = require('ncp');
var rimraf = require('rimraf');
var Site = require('..');
beforeEach(done => { ncp('test/site', 'test/site0', done); });
afterEach(done => { rimraf('test/site0', done); });
it('start and stop', async function () {
	var site = new Site({ dir: "test/site0/" });
	site.start();
	var port = site.server.address().port;
	var adminPort = site.adminServer.address().port;
	await request.get(`http://localhost:${port}`);
	await request.get(`http://localhost:${adminPort}`);
	site.stop();
	assertThrows(() => request.get(`http://localhost:${port}`));
	assertThrows(() => request.get(`http://localhost:${adminPort}`));
});
it('proxy', async function () {
	try {
		var site = new Site({ dir: "test/site0/" });
		site.start();
		var port = site.server.address().port;
		var adminPort = site.adminServer.address().port;
		var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
		targetServer.listen(8008);
		var response = await request.put(`http://localhost:${adminPort}/proxy-rule/%2fa`, { json: true, body: "http://localhost:8008" });
		assert.equal(response.statusCode, 201);
		var response = await request.get(`http://localhost:${port}/a`);
		assert.equal(response.body, "42");
		var response = await request.delete(`http://localhost:${adminPort}/proxy-rule/%2fa`);
		assert.equal(response.statusCode, 204);
		var response = await request.get(`http://localhost:${port}/a`);
		assert.equal(response.statusCode, 404);
	} finally {
		targetServer.close();
		site.stop();
	}
});
it('vhost', async function () {
	try {
		var site = new Site({ dir: "test/site0/" });
		site.start();
		var port = site.server.address().port;
		var adminPort = site.adminServer.address().port;
		var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
		targetServer.listen(8008);
		var response = await request.put(`http://localhost:${adminPort}/vhost/a.localhost`, { json: true, body: "http://localhost:8008" });
		assert.equal(response.statusCode, 201);
		var response = await request.get(`http://127.0.0.1:${port}`, { headers: { "Host": `a.localhost:${port}` } });
		assert.equal(response.body, "42");
		var response = await request.delete(`http://localhost:${adminPort}/vhost/a.localhost`);
		assert.equal(response.statusCode, 204);
		var response = await request.get(`http://127.0.0.1:${port}`, { headers: { "Host": `a.localhost:${port}` } });
		assert.equal(response.statusCode, 404);
	} finally {
		targetServer.close();
		site.stop();
	}
});
it('app.middleware', async function () {
	await testApp({
		"type": "middleware",
		"module": "./middleware.js",
		"arguments": [],
		"port": 8008
	});
});
it('app.standalone', async function () {
	await testApp({
		"type": "standalone",
		"module": "./standalone.js",
		"arguments": [],
		"env": { PORT: 8008 },
		"port": 8008
	});
});
it('app.npm-start', async function () {
	await testApp({
		"type": "npm-start",
		"module": "./npm-start",
		"arguments": [],
		"env": { PORT: 8008 },
		"port": 8008
	});
});
async function testApp(app) {
	try {
		var site = new Site({ dir: "test/site0/" });
		site.start();
		var port = site.server.address().port;
		var adminPort = site.adminServer.address().port;
		var response = await request.put(`http://localhost:${adminPort}/app/a`, { json: true, body: app });
		assert.equal(response.statusCode, 201);
		var response = await request.post(`http://localhost:${adminPort}/app/a/start`);
		assert.equal(response.statusCode, 204);
		var response = await request.put(`http://localhost:${adminPort}/proxy-rule/%2fa`, { json: true, body: "app:a" });
		assert.equal(response.statusCode, 201);
		await waitFor(
			() => request.get(`http://localhost:${port}/a`)
				.then(response => response.statusCode == 200),
			{ interval: 100 }
		);
		var response = await request.get(`http://localhost:${port}/a`);
		assert.equal(response.body, "42");
		var response = await request.post(`http://localhost:${adminPort}/app/a/stop`);
		assert.equal(response.statusCode, 204);
		await waitFor(
			() => request.get(`http://localhost:${adminPort}/app/a`, { json: true })
				.then(response => !response.body.running),
			{ interval: 100 }
		);
		var response = await request.delete(`http://localhost:${adminPort}/app/a`);
		assert.equal(response.statusCode, 204);
		var response = await request.get(`http://localhost:${port}/a`);
		assert.equal(response.statusCode, 404);
	} finally {
		site.stop();
	}
}
it('module', async function () {
	try {
		this.timeout(10000);
		var site = new Site({ dir: "test/site0/" });
		site.start();
		var adminPort = site.adminServer.address().port;
		var response = await request.post(`http://localhost:${adminPort}/module/`, { json: true, body: { source: "./a" } });
		assert.equal(response.statusCode, 201);
		var response = await request.get(`http://localhost:${adminPort}/module/a`, { json: true });
		assert.deepEqual(response.body, { source: "./a" });
		var response = await request.delete(`http://localhost:${adminPort}/module/a`);
		assert.equal(response.statusCode, 204);
		var response = await request.get(`http://localhost:${adminPort}/module/a`);
		assert.equal(response.statusCode, 404);
	} finally {
		site.stop();
	}
});
