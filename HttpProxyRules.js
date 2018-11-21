var HttpProxyRules = require('http-proxy-rules');
var HttpProxyRules = new Proxy(HttpProxyRules, {
	construct: (target, args) => {
		var $this = new target({ rules: {} });
		var arg = args[0];
		$this.rules = EnumerateWithout(arg, '');
		Object.defineProperty($this, 'default', { get: () => arg[''] });
		return $this;
	}
});
function EnumerateWithout(target, property) {
	return new Proxy(target, {
		ownKeys: Object.keys,
		getOwnPropertyDescriptor: (target, p) => ({ enumerable: p != property, configurable: true })
	});
}
module.exports = HttpProxyRules;
