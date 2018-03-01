import http from 'http'
import https from 'https'
import http2 from 'http2'
import fs from 'fs'
import pathModule from 'path'
import {MIME, getMime} from './util.mjs'
import {loadOrGenerateCertificate} from './cert.mjs'
import {root, port} from './options.mjs'


const {
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_METHOD,
	HTTP_STATUS_NOT_FOUND,
	HTTP_STATUS_INTERNAL_SERVER_ERROR
} = http2.constants

function launchHttp2Server({key, cert}) {
	const options = {key, cert}
	const server = http2.createSecureServer(options)
	server.on('stream', onStream)
	server.on('listening', () => console.log('listening'))
	server.listen(443)
}
/*
function onStream(stream, headers) {
	var reqPath = headers[HTTP2_HEADER_PATH]
	var method = headers[HTTP2_HEADER_METHOD]

	var fullPath = pathModule.join(root, reqPath)
	var mime = getMime(reqPath)

	stream.respondWithFile(fullPath, {
		'content-type': mime
	}, {
		onError: err => respondToStreamError(err, stream)
	})
}
*/


function respondToStreamError(err, stream) {
	console.log(err)
	if (err.code === 'ENOENT') {
		stream.respond({':status': HTTP_STATUS_NOT_FOUND})
	} else {
		stream.respond({':status': HTTP_STATUS_INTERNAL_SERVER_ERROR})
	}
	stream.end()
}


console.log('before')
loadOrGenerateCertificate()
	//.then(launchHttp2Server)
	.then(launchHybridServer)
	.catch(console.error)
console.log('after')



function launchHybridServer({key, cert}) {
	console.log('launchHybridServer')
	var type = 'http2'
	//var type = 'hybird'
	var secure = true

	if (secure)
		var options = {key, cert}
	else
		var options = {}

	if (type === 'hybird')
		options.allowHTTP1 = true

	if (type === 'http2' || type === 'hybird') {
		var server = secure ? http2.createSecureServer(options) : http2.createServer(options)
	} else {
		var server = secure ? https.createServer(options) : http.createServer()
	}

	console.log(type, type === 'http1', type === 'hybird')
	if (type === 'http1' || type === 'hybird')
		server.on('request', onRequest)
	
	if (type === 'http2' || type === 'hybird')
		server.on('stream', onStream)

	if (secure)
		server.listen(443)
	else
		server.listen(port)

	server.on('listening', () => console.log('listening'))
}

function onRequest(req, res) {
	console.log('onRequest')
	var socket = req.httpVersion === '2.0' ? req.stream.session.socket : req.socket
	var alpnProtocol = socket.alpnProtocol
	var httpVersion = req.httpVersion
	if (httpVersion === '2.0') return
	res.writeHead(200, {'content-type': 'application/json'})
	var json = JSON.stringify({alpnProtocol, httpVersion, type: 'onRequest'})
	res.end(json)
}

function onStream(stream, reqHeaders) {
	var reqPath = reqHeaders[HTTP2_HEADER_PATH]
	var method = reqHeaders[HTTP2_HEADER_METHOD]

	var fullPath = path.join(serverRoot, reqPath)
	var responseMimeType = getMime(fullPath)

	var onError = err => respondToStreamError(err, stream)

	stream.respondWithFile(fullPath, {'content-type': responseMimeType}, {onError})
	if (fullPath.endsWith('.html')) {
		stream.pushStream({':path': '/font.woff'}, pushStream => {
			var fontPath = path.join(serverRoot, "/font.woff")
			pushStream.respondWithFile(fontPath, {'content-type': 'text/css'}, {onError})
		})
	}

}

function onStream(stream, reqHeaders) {
	console.log('onStream')
	var reqPath = reqHeaders[HTTP2_HEADER_PATH]
	var method = reqHeaders[HTTP2_HEADER_METHOD]
	console.log('reqPath', reqPath)
	console.log('method', method)
	stream.respond({
		':status': 200,
		'content-type': 'text/plain'
	})
	stream.write('hello ')
	stream.end('world')
	//var fullPath = pathModule.join(root, relPath)
	//var mime = getMime(relPath)
	//var headers = {content-type': mime}
	//stream.respondWithFile(fullPath, headers, {
	//	onError: err => respondToStreamError(err, stream)
	//})
}

//https://github.com/felixge/node-stream-cache
//https://github.com/cloudhead/node-static/blob/master/lib/node-static.js