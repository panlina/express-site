var assert = require('assert');
var http = require("http");
var request = require('request');
var Site = require('..');
it('should start and stop', function (done) {
	var site = new Site({ dir: "test/site/", adminPort: 9000 });
	site.start();
	request.get("http://localhost", (error, response) => {
		assert(response);
		site.stop();
		request.get("http://localhost", (error, response) => {
			assert(error);
			done();
		});
	});
});
it('proxy should work', function (done) {
	var site = new Site({ dir: "test/site/", adminPort: 9000 });
	site.start();
	var targetServer = http.createServer((req, res) => { res.write("42"); res.end(); })
	targetServer.listen(8080);
	request.put("http://localhost:9000/proxy-rule/%2fa", { json: true, body: "http://localhost:8080" }, (error, response) => {
		request.get("http://localhost/a", (error, response) => {
			assert(response);
			assert.equal(response.body, "42");
			targetServer.close();
			site.stop();
			done();
		});
	});
});
