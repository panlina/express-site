function ProxyRules(target) {
	return new Proxy(target, {
		get: (target, property) =>
			property ?
				target.rules[property] :
				target.default,
		set: (target, property, value) => {
			if (property)
				target.rules[property] = value;
			else
				target.default = value;
		},
		deleteProperty: (target, property) => {
			if (property)
				delete target.rules[property];
			else
				delete target.default;
		},
		has: (target, property) =>
			property ?
				property in target.rules :
				'default' in target,
		ownKeys: target => {
			var keys = Object.keys(target.rules);
			if ('default' in target)
				keys.push('');
			return keys;
		},
		getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
	});
}
module.exports = ProxyRules;
