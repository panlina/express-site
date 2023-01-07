var path = require('path');
module.exports = site => ({
	resolve: spec => {
		var resolve = require(path.resolve(path.join(site.config.dir, 'require.resolve.js')));
		return resolve(spec);
	}
});
