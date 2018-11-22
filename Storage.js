var fs = require('fs');
function Storage(file, construction = {}) {
	try {
		var target = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (construction.constructor)
			construct(target);
	} catch (e) {
		var target = {};
		fs.writeFileSync(file, JSON.stringify(target), 'utf8');
	}
	return new Proxy(target, {
		set: (target, property, value) => {
			target[property] = value;
			if (construction.destructor)
				target = destruct(target);
			fs.writeFile(file, JSON.stringify(target, undefined, '\t'), 'utf8', err => { if (err) console.log(err); });
		},
		deleteProperty: (target, property) => {
			delete target[property];
			if (construction.destructor)
				target = destruct(target);
			fs.writeFile(file, JSON.stringify(target, undefined, '\t'), 'utf8', err => { if (err) console.log(err); });
		}
	})
	function destruct(target) {
		var json = {};
		for (var name in target)
			json[name] = construction.destructor(target[name]);
		return json;
	}
	function construct(target) {
		for (var name in target)
			target[name] = new construction.constructor(target[name]);
	}
}
module.exports = Storage;
