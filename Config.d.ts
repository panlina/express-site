interface Config {
	dir: string;
	port?: number;
	ssl?: boolean;
	cert?: string;
	key?: string;
	adminPort: number;
	adminSsl?: boolean;
	adminCors?: boolean;
}
export = Config;
