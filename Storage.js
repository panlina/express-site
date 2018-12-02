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
			store();
		},
		deleteProperty: (target, property) => {
			delete target[property];
			store();
		}
	})
	var dirty;
	function store() {
		if (dirty) return;
		setTimeout(() => {
			var json = target;
			if (construction.destructor)
				json = destruct(json);
			fs.writeFile(file, JSON.stringify(json, undefined, '\t'), 'utf8', err => { if (err) console.log(err); });
			dirty = false;
		}, 0);
		dirty = true;
	}
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
