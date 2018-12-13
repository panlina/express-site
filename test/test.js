var assert = require('assert');
var request = require('request');
var Site = require('..');
it('should be up', function (done) {
	var site = new Site({ dir: "test/site/", adminPort: 9000 });
	site.start();
	request.get("http://localhost", (error, response) => {
		assert(response);
		done();
	});
});
