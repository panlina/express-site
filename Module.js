module.exports.resolve = spec => {
	if (spec.startsWith("site:")) {
		var name = spec.substr("site:".length);
		spec = `./site_modules/node_modules/${name}`;
	}
	return spec;
};
