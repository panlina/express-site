var assert = require('assert');
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
