import http from 'http'
import https from 'https'
import http2 from 'http2'
import path from 'path'
import {getOptions} from './options.mjs'
import {serve} from './handler.mjs'
import {loadOrGenerateCertificate} from './cert.mjs'
import {shimReqHttp2, shimReqHttp1, shimResMethods} from './shim.mjs'


//https://github.com/felixge/node-stream-cache
//https://github.com/cloudhead/node-static/blob/master/lib/node-static.js

// todo, dual - both http and https
export async function launchHybridServer(...args) {
	var options = getOptions(...args)

	if (options.secure)
		options = await loadOrGenerateCertificate(options)

	if (options.version & 1)
		options.allowHTTP1 = true

	if (options.version & 2) {
		var server = options.secure ? http2.createSecureServer(options) : http2.createServer(options)
	} else {
		var server = options.secure ? https.createServer(options) : http.createServer()
	}

	// todo: test if hybrid still fires 'stream' event

	if (options.version === 1)
		server.on('request', onRequest.bind({options}))
	if (options.version === 3)
		server.on('request', onRequest.bind({options})) // todo
	if (options.version === 2)
		server.on('stream', onStream.bind({options}))

	if (options.secure === false)
		server.listen(options.port[0])
	else
		server.listen(options.port[1])

	server.on('listening', () => console.log('listening'))
}

function onRequest(req, res) {
	//console.log('onRequest')
	var options = this.options
	// Shims some http2 colon headers into 'req' object.
	shimReqHttp2(req)
	serve(req, res, options)
}

async function onStream(stream, headers) {
	//console.log('onStream')
	var options = this.options
	// Shims http1 like 'req' object out of http2 headers.
	var req = shimReqHttp1(headers)
	//
	shimResMethods(stream)
	//
	serve(req, stream, options)
}