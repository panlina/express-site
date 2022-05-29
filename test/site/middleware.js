module.exports = () =>
	(req, res) => {
		res.write("42");
		res.end();
	};
