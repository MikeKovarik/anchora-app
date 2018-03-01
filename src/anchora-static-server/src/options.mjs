import path from 'path'

// options object gets passed as an argument to https.Server or http2.SecureServer (and tls.Server)
// https://nodejs.org/dist/latest-v9.x/docs/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
// https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler

var defaultOptions = {
	root: undefined,
	//certRoot: path.join(process.cwd(), './certificates'),
	certPath: './selfsigned.crt',
	keyPath:  './selfsigned.key',
	cert: undefined,
	key:  undefined,
	indexFile: 'index.html',
	port: [80, 443],
	type: 'http1',
	secure: false,
	stream: true,
	// string values are directly set as cache-control header
	// true equals to max-age=${maxAge}
	// false equals to no-cache
	// default 'must-revalidate' enables caching, forces requesting every file, but returns 403 if nothing was modified.
	cacheControl: 'must-revalidate',
	// keep files (buffer and streams) in memory for repeated reloading the same resources
	serverCache: 1024 * 1024 * 100,
	// true, false, 'passive', 'active'
	encoding: 'passive',
	cors: true,
	// info about server passed as 'server' header
	info: 'Anchora static server',
	listDir: true,
}

export default defaultOptions

export function getOptions(...args) {
	switch (args.length) {
		case 3:
			var [type, port, userOptions] = args
			userOptions = getPreset(userOptions)
			userOptions.type = type
			userOptions.port = port
			break
		case 2:
			var [type, arg] = args
			if (Array.isArray(arg) || typeof arg === 'number')
				userOptions = {port: arg}
			else
				userOptions = getPreset(arg)
			userOptions.type = type
			break
		default:
			var [arg] = args
			var argType = typeof arg
			if (Array.isArray(arg) || argType === 'number')
				userOptions = {port: arg}
			else if (argType === 'string')
				userOptions = {type: arg}
			else
				userOptions = arg
			break
	}

	var options = Object.assign({}, defaultOptions, userOptions)

	switch(options.type) {
		case 'http':
			options.version = 1
			options.secure = false
			break
		case 'https':
			options.version = 1
			options.secure = true
			break
		case 'http2':
			options.version = 2
			options.secure = true
			break
		//case 'hybrid': // http2 with http1
		//case 'both': // https and https
		//	options.version = 2
		//	options.secure = true
		//	break
	}

	if (typeof options.port === 'number') {
		if (options.port === 443)
			options.secure = true
		if (options.secure)
			options.port = [undefined, options.port]
		else
			options.port = [options.port, undefined]
	}

	if (options.version === 1)
		options.stream = false

	var cc = options.cacheControl
	if (typeof cc === 'number' || cc === true) {
		options.maxAge = cc
		cc = `max-age=${cc}`
	} else if (cc === false) {
		cc = 'no-cache'
	}

	if (options.gzip === false)
		options.encoding = false

	return options
}

function getPreset(name) {
	if (name === 'dev') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 'must-revalidate',
			encoding: false,
			cors: true,
			listDir: true,
			serverCache: true,
		})
	} else if (name === 'production' || name === 'prod') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 1000 * 60 * 24,
			encoding: true,
			listDir: false,
		})
	} else if (typeof name === 'string') {
		return {}
	} else {
		return name
	}
}