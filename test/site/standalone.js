var http = require('http');
var server = http.createServer((req, res) => {
    res.write("42");
    res.end();
});
server.listen(8008);
