var http = require('http');
var server = http.createServer((req, res) => {
	if (req.url == '/arguments') {
		res.write(process.argv.slice(2).join(' '));
		res.end();
		return;
	}
	res.write("42");
	res.end();
});
server.listen(+process.env.PORT);
