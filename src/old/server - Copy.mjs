import http from 'http'
import https from 'https'
import http2 from 'http2'
import url from 'url'
import path from 'path'
import etag from 'etag'
import StreamCache from 'stream-cache'
import {fs, MIME, ERRCODE, getMime, getParentPath} from './util.mjs'
import {loadOrGenerateCertificate} from './cert.mjs'
import options from './options.mjs'
import {getDescriptor, renderDirectory} from './server-handler.mjs'


//https://github.com/felixge/node-stream-cache
//https://github.com/cloudhead/node-static/blob/master/lib/node-static.js

launchHybridServer(options)
	.catch(console.error)
/*
const {
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_METHOD,
	HTTP2_HEADER_STATUS,
	HTTP2_HEADER_CONTENT_TYPE,
	HTTP_STATUS_NOT_FOUND,
	HTTP_STATUS_INTERNAL_SERVER_ERROR
} = http2.constants
*/

async function launchHybridServer(options) {
	var {port, type, secure} = options
	console.log('launchHybridServer')

	if (secure)
		var srvOpts = await loadOrGenerateCertificate()
	else
		var srvOpts = {}

	if (type === 'hybird')
		srvOpts.allowHTTP1 = true

	if (type === 'http2' || type === 'hybird') {
		var server = secure ? http2.createSecureServer(srvOpts) : http2.createServer(srvOpts)
	} else {
		var server = secure ? https.createServer(srvOpts) : http.createServer()
	}

	if (type === 'http1')
		server.on('request', onRequest)
	if (type === 'hybird')
		server.on('request', onRequest) // todo
	if (type === 'http2')
		server.on('stream', onStream)

	if (secure)
		server.listen(443) // todo
	else
		server.listen(port)

	server.on('listening', () => console.log('listening'))
}

function onRequest(req, res) {
	console.log('req.headers', req.headers)
	console.log('typeof res.stream', typeof res.stream)
	var reqHeaders = req.headers
	reqHeaders[':path'] = req.url
	reqHeaders[':method'] = req.method
	reqHeaders[':authority'] = req.host // ??
	serve(req, res, reqHeaders)
}

async function onStream(stream, reqHeaders) {
	console.log('reqHeaders', reqHeaders)
	var req = {
		url: reqHeaders[':path'],
		method: reqHeaders[':method'],
		headers: reqHeaders,
		stream
	}
	serve(req, stream, reqHeaders)
}

async function serve(req, resOrStream, reqHeaders) {
	console.log('-----------------------------------------')
	var relPath = req.url.split('/')
		.map(section => decodeURI(section))
		.join('/')
	var fullPath = path.join(options.root, relPath)
	console.log('relPath', relPath)
	//console.log(reqHeaders)

	try {
		var desc = await getDescriptor(fullPath, relPath)
	} catch(err) {
		serveError(resOrStream, 404, err)
		return
	}

	var resHeaders = {}

	if (options.cors)
		setCorsHeaders(resHeaders)

	// TODO CSP, 'Content-Security-Policy', 'Upgrade-Insecure-Requests'

	try {
		if (desc.folder)
			serveFolderStream(resOrStream, reqHeaders, resHeaders, desc)
		else if (desc.file)
			serveFileStream(resOrStream, reqHeaders, resHeaders, desc)
	} catch(err) {
		console.error('caught error', err)
		serveError(resOrStream, 500, err)
	}
}

async function serveFolderStream(resOrStream, reqHeaders, resHeaders, desc) {
	var names = await fs.readdir(desc.fullPath)
	if (names.includes('index.html')) {
		// Redirect to index.html.
		writeHead(resOrStream, 302, {
			'location': path.join(relPath, 'index.html')
		})
		resOrStream.end()
	} else {
		// Render contents of the folder.
		var html = await renderDirectory(desc)
		resHeaders['content-type'] = 'text/html'
		writeHead(resOrStream, 200, resHeaders)
		resOrStream.end(html)
	}
}

function serveFileStream(resOrStream, reqHeaders, resHeaders, desc) {
	resHeaders['content-type'] = desc.mime
	resHeaders['content-length'] = desc.size

	if (options.cache) {
		resolveCacheHeaders(reqHeaders, resHeaders)
		if (hasBeenModified(reqHeaders, resHeaders)) {
			writeHead(resOrStream, 304, resHeaders)
			return resOrStream.end()
		}
	}

	writeHead(resOrStream, 200, resHeaders)
	var fileStream = getReadStream(desc, options)
	if (ext === 'html' && req.stream && options.stream) {
		console.log('TODO, open push stream')
	}
	fileStream.on('error', err => onError(resOrStream, err))
	fileStream.pipe(resOrStream)
}


/*
function writeHead(req, res, code, resHeaders) {
	if (req.stream) {
		resHeaders[':status'] = code
		req.stream.respond(resHeaders)
	} else {
		res.writeHead(code, resHeaders)
	}
}
*/
function writeHead(resOrStream, code, resHeaders) {
	if (resOrStream.constructor.name === 'ServerHttp2Stream') {
		resHeaders[':status'] = code
		resOrStream.respond(resHeaders)
	} else {
		resOrStream.writeHead(code, resHeaders)
	}
}

function serveError(resOrStream, code, err) {
	writeHead(resOrStream, code, {
		':status': code,
		'content-type': 'text/plain',
		//'content-length': 0,
		//'cache-control': 'max-age=0',
	})
	var data = `${code} ${ERRCODE[code]}`
	if (err) data += ', ' + err
	resOrStream.write(data)
	resOrStream.end()
}

function onError(resOrStream, err) {
	if (err.code === 'ENOENT')
		serveError(resOrStream, 404, err)
	else
		serveError(resOrStream, 500, err)
}



function resolveCacheHeaders(reqHeaders, resHeaders) {
	// It is important to specify:
	// - one of Expires or Cache-Control max-age
	// - one of Last-Modified or ETag
	// It is redundant to specify both (expires and cc or modified and etag)
	var cacheControl = reqHeaders['cache-control'] || reqHeaders.pragma
	if (cacheControl !== 'no-cache' && cacheControl !== 'max-age=0') {
		// A way to tell browser how fresh the file is. Redundant if last-modified is specified.
		resHeaders.etag = etag(desc.stat)
		// A way to tell browser how fresh the file is. Redundant if etag is specified.
		resHeaders['last-modified'] = desc.modified.toGMTString()
		// If the user provided a max-age for caching, add the cache header.
		var seconds = options.maxAge
		resHeaders['cache-control'] = 'max-age=' + seconds
		var millis = seconds * 1000
		var expires = new Date(Date.now() + millis)
		resHeaders.expires = expires.toGMTString()
	}
}

function hasBeenModified(reqHeaders, resHeaders) {
	var reqModified = reqHeaders['if-modified-since']
	var reqEtag = reqHeaders['if-none-match']
	return reqModified && reqModified === desc.modified.toGMTString()
		|| reqEtag && reqEtag === resHeaders.etag
}
function hasBeenModifiedDesc(cachedDesc, desc) {
}

var fsCache = new Map

function getReadStream(desc, options) {
	var {fullPath} = desc
	if (options.cache) {
		var cached = fsCache.get(fullPath)
		if (!cached || cached && hasBeenModifiedDesc(cached.desc, desc)) {
			cached = {
				desc,
				stream: new StreamCache()
			}
			fs.createReadStream(fullPath).pipe(cached.stream)
			fsCache.set(fullPath, cached)
		}
		return cached.stream
	} else {
		return fs.createReadStream(fullPath)
	}
}

function setCorsHeaders(resHeaders) {
	// Website you wish to allow to connect
	resHeaders['Access-Control-Allow-Origin'] = '*'
	// Request methods you wish to allow
	resHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
	// Request headers you wish to allow
	resHeaders['Access-Control-Allow-Headers'] = 'X-Requested-With,content-type'
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	resHeaders['Access-Control-Allow-Credentials'] = true
}


/*

const onRequestHandler = (req, res) => {  
	if (req.url === '/') {
		var file = {
			path: '/style.css',
			filePath: './style.css',
			headers: {'content-type': 'text/css'}
		}
		pushAsset(res.stream, file)
	}
}

const pushAsset = (stream, file) => {  
	const filePath = path.join(__dirname, file.filePath)
	stream.pushStream({ [HTTP2_HEADER_PATH]: file.path }, (pushStream) => {
		pushStream.respondWithFile(filePath, file.headers)
	})
}

*/



/*
function onStream(stream, reqHeaders) {
	var relPath = reqHeaders[HTTP2_HEADER_PATH]
	var method = reqHeaders[HTTP2_HEADER_METHOD]

	var fullPath = path.join(options.root, relPath)
	var mime = getMime(fullPath)

	var onError = err => onError(stream, err)

	stream.respondWithFile(fullPath, {'content-type': mime}, {onError})
	if (fullPath.endsWith('.html')) {
		stream.pushStream({':path': '/font.woff'}, pushStream => {
			var fontPath = path.join(options.root, "/font.woff")
			pushStream.respondWithFile(fontPath, {'content-type': 'text/css'}, {onError})
		})
	}

}

function onStream(stream, reqHeaders) {
	console.log('onStream')
	var relPath = reqHeaders[HTTP2_HEADER_PATH]
	var method = reqHeaders[HTTP2_HEADER_METHOD]
	console.log('relPath', relPath)
	console.log('method', method)
	stream.respond({
		':status': 200,
		'content-type': 'text/plain'
	})
	stream.write('hello ')
	stream.end('world')
	//var fullPath = pathModule.join(options.root, relPath)
	//var mime = getMime(relPath)
	//var headers = {content-type': mime}
	//stream.respondWithFile(fullPath, headers, {
	//	onError: err => onError(stream, err)
	//})
}
*/