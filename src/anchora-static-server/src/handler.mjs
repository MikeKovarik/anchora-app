import path from 'path'
import {fs, MIME, ERRCODE} from './util.mjs'
import {getCachedReadStream, isFileUnchanged, setCacheHeaders} from './cache.mjs'
import {getDescriptor, openDescriptor, compressStream} from './files.mjs'


export async function serve(req, res, options) {
	var url = decodeURI(req.url)
	//console.log(url)

	var fsPath = path.join(options.root, url)
	var desc = await openDescriptor(url, fsPath)
	if (desc === undefined) {
		console.log('-----------------------------------------')
		console.log('404', url)
		serveError(res, 404)
		return
	}

	// todo
	if (options.headers) {
		for (var key in options.headers)
			res.setHeader(key, options.headers[key])
	}

	if (options.info)
		res.setHeader('server', options.info)

	if (options.cors)
		setCorsHeaders(res)

	if (options.csp) {
		// TODO CSP, 'Content-Security-Policy', 'Upgrade-Insecure-Requests'
	}

	try {
		if (desc.folder)
			serveFolder(req, res, desc, options)
		else if (desc.file)
			serveFile(req, res, res.stream, desc, options)
		else
			serveError(res, 400)
	} catch(err) {
		console.error(err)
		serveError(res, 500, err)
	}
}

async function serveFolder(req, res, desc, options) {
	console.log('-----------------------------------------')
	console.log('dir', req.url)
	var indexPath = path.join(desc.fsPath, options.indexFile)
	try {
		await fs.stat(indexPath)
		// Redirect to index.html.
		var indexUrl = path.join(desc.url, options.indexFile)
		res.setHeader('location', indexUrl)
		res.writeHead(301)
		res.end()
	} catch(err) {
		// Render contents of the folder.
		var html = await renderDirectory(desc)
		res.setHeader('content-type', 'text/html')
		res.writeHead(200)
		res.end(html)
	}
}

//import {pushFile} from './files.mjs'
import {stringifyStream, openReadStream, createEtag} from './files.mjs'
import {parse} from './code-parser.mjs'
import {fsCache} from './cache.mjs'

async function serveFile(req, res, sink, desc, options) {
	console.log('-----------------------------------------')
	var serveType = res === sink || sink === undefined ? 'file' : 'push'
	console.log(serveType, desc.url)

	sink.setHeader('content-type', desc.mime)

	var etag = createEtag(desc)
	sink.setHeader('etag', etag)
	sink.setHeader('last-modified', desc.mtime.toGMTString())

	/*if (options.cacheControl !== false) {
		setCacheHeaders(req, res, desc, options)
		if (isFileUnchanged(req, res, desc)) {
			sink.writeHead(304)
			console.log(304)
			return sink.end()
		}
	}*/

	/*if (options.encoding === 'passive') {
		// TODO: try to get .gz file
	}*/

	var fileStream = openReadStream(desc)
	//var fileStream = getCachedReadStream(desc, options)
	fileStream.on('error', err => serveError(sink, 500, err))

	var isParseable = desc.ext // TODO
	if (options.stream && isParseable && sink !== undefined) {
		console.log('can push')
		var cached = fsCache.retrieve(desc)
		if (cached && cached.dependencies && cached.desc && cached.desc.etag === etag) {
			console.log('preparsed', desc.name)
			// preparsed
			if (cached.dependencies.length)
				pushFiles(req, res, desc, cached.dependencies, options) // TODO: lookup all subdependencies
		} else {
			console.log('parsing', desc.name)
			// parse for the first time
			var [fileStream, fileString] = await stringifyStream(fileStream)
			var parsed = parse(fileString, desc.ext)
			if (parsed) {
				// store and load peers
				console.log('done parsing', desc.name)
				// Transform sub urls relative to directory into absolute urls starting at root.
				var dirUrl = path.parse(desc.url).dir
				// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
				var urls = parsed.map(subUrl => path.posix.join(dirUrl, subUrl))
				// TODO: some options.cacheFiles option to store or not store the stream (separate from desc and parsed deps)
				fsCache.extend(desc, undefined, urls)
				pushFiles(req, res, desc, urls, options) // TODO: lookup all subdependencies
			} else {
				// no peers
				fsCache.extend(desc, undefined, [])
			}
		}
	} else {
		console.log('wont push')
	}

	/*if (options.encoding === 'active') {
		fileStream = compressStream(req, res, fileStream)
		// todo content-length of gzipped stream
		//sink.setHeader('content-length', ???)
	} else {
		sink.setHeader('content-length', desc.size)
	}*/

	console.log('writing to sink', desc.name)
	sink.writeHead(res === sink ? 200 : undefined)
	fileStream.pipe(sink)

	/*function finish() {
		fileStream.removeListener('end', finish)
		fileStream.removeListener('error', finish)
		console.log('FINISH', desc)
		fs.close(desc.fd).then(() => console.log(desc.name, 'closed'))
	}
	fileStream.once('end', finish)
	fileStream.once('error', finish)*/
}

import {shimResMethods} from './shim.mjs'

async function pushFiles(req, res, desc, fileNames, options) {
	console.log('pushing', fileNames)
	var promises = fileNames.map(url => pushFile(req, res, desc, url, options))
	return Promise.all(promises)
}
async function pushFile(req, res, indexDesc, url, options) {
	if (res.stream.destroyed) return
	// Create absolute disk file path from url
	var filePath = path.join(options.root, url)
	var desc = await openDescriptor(url, filePath)
	if (res.stream.destroyed) return
	var pushStream = await openPushStream(res.stream, desc.url)
	shimResMethods(pushStream)
	serveFile(req, res, pushStream, desc, options)
}
function openPushStream(stream, url) {
	return new Promise(resolve => {
		stream.pushStream({':path': url}, resolve)
	})
}


function serveError(res, code, err) {
	var body = `${code} ${ERRCODE[code]}`
	if (err) body += ', ' + err
	res.setHeader('content-type', 'text/plain')
	res.setHeader('content-length', Buffer.byteLength(body))
	res.setHeader('cache-control', 'max-age=0')
	res.writeHead(code)
	res.write(body)
	res.end()
}


function setCorsHeaders(res) {
	// Website you wish to allow to connect
	res.setHeader('access-control-allow-origin', '*')
	// Request methods you wish to allow
	res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
	// Request headers you wish to allow
	res.setHeader('access-control-allow-headers', 'X-Requested-With,content-type')
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('access-control-allow-credentials', true)
}

// todo: If-Range
// todo: Content-Range


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
function onError(res, err) {
	serveError(res, err.code === 'ENOENT' ? 404 : 500, err)
}
*/



export async function renderDirectory(desc) {
	//console.log('renderDirectory', desc)
	var {fsPath, url} = desc
	var names = await fs.readdir(fsPath)
	var descriptors = names.map(name => {
		return getDescriptor(path.join(url, name), undefined, fsPath, name)
	})
	//var descriptors = names.map(name => getDescriptorOld(fsPath, name, url))
	descriptors = await Promise.all(descriptors)
	var files = descriptors.filter(desc => desc.file)
	var folders = descriptors.filter(desc => desc.folder)

	function renderRow(desc) {
		var {name, size, modified, url} = desc
		//console.log('renderRow', name, url)
		if (modified === undefined)
			var date = ''
		else
			var date = modified.toLocaleDateString() + ' ' + modified.toLocaleTimeString()
		return `
		<tr>
			<td><a href="${url}">${name}</a></td>
			<td>${size}</td>
			<td>${date}</td>
		</tr>`
	}

	var parentUrl = path.parse(url).dir
	var rows = '<tr>' + [
		renderRow({
			name: '..',
			url: parentUrl
		}),
		...folders.map(renderRow),
		...files.map(renderRow)
	].join('\n') + '</tr>'

	return `<table>
		<tr>
			<th><a href="">Name</a></th>
			<th><a href="">Size</a></th>
			<th><a href="">Last Modified</a></th>
		</tr>
		${rows}
	</table>
	<style>body {font-family: Segoe UI}</style>
	`
}
