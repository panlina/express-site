var fs = require('fs');
function Storage(file) {
	try {
		var target = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (e) {
		var target = {};
		fs.writeFileSync(file, JSON.stringify(target), 'utf8');
	}
	return new Proxy(target, {
		set: (target, property, value) => {
			target[property] = value;
			fs.writeFile(file, JSON.stringify(target, undefined, '\t'), 'utf8', err => { if (err) console.log(err); });
		},
		deleteProperty: (target, property) => {
			delete target[property];
			fs.writeFile(file, JSON.stringify(target, undefined, '\t'), 'utf8', err => { if (err) console.log(err); });
		}
	})
}
module.exports = Storage;
