var path = require('path');
module.exports.resolve = (dir, spec) => {
	if (spec.startsWith("site:")) {
		var name = spec.substr("site:".length);
		spec = `./site_modules/node_modules/${name}`;
	}
	var resolve = require(path.resolve(path.join(dir, 'require.resolve.js')));
	return resolve(spec);
};
