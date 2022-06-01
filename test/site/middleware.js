module.exports = (...arguments) =>
	(req, res) => {
		if (req.url == '/arguments') {
			res.write(arguments.join(' '));
			res.end();
			return;
		}
		res.write("42");
		res.end();
	};
