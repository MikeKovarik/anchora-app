import path from 'path'
import options from './options.mjs'
import {fs, MIME, ERRCODE, getMime, getParentPath} from './util.mjs'
//import {} from './util.mjs'


export async function onRequest(req, res) {
	var relPath = req.url.split('/')
		.map(section => decodeURI(section))
		.join('/')
	var fullPath = path.join(options.root, relPath)

	try {
		var desc = await getDescriptor(fullPath)
	} catch(err) {
		serveError(res, 404)
		return
	}

	try {
		if (desc.folder)
			serveFolder(req, res, desc)
		else if (desc.file)
			serveFile(req, res, desc)
	} catch(err) {
		console.error('caught error', err)
		serveError(res, 500, err)
	}

}

async function serveFolder(req, res, desc) {
	var {fullPath, relPath} = desc

	var names = await fs.readdir(fullPath)
	if (names.includes('index.html')) {
		// redirect to index.html
		res.writeHead(302, {
			'Location': path.join(relPath, 'index.html')
		})
		res.end()
	} else {
		// render list of files inside the folder
		var headers = {'Content-Type': 'text/html'}
		var html = await renderDirectory(desc)
		res.writeHead(200, headers)
		res.write(html)
		res.end()
	}
}

function serveFile(req, res, desc) {
	var {fullPath, relPath, mime} = desc

	// return the file
	var resHeaders = {
		'content-type': desc.mime,
		'content-length': desc.size,
	}

	if (options.etag)
		resHeaders.ETag = etag(desc.stat)

	if (options.cors)
		setCorsHeaders(resHeaders)

	// If the user provided a max-age for caching, add the cache header.
	if (options.maxAge)
		resHeaders['Cache-Control'] = 'max-age=' + options.maxAge

	writeHead(res, 200, resHeaders)
	var fileStream = fs.createReadStream(fullPath)
	fileStream.on('error', err => serveError(res, 500, err))
	fileStream.pipe(res)
}

function writeHead(res, code, headers, isStream) {
	if (isStream) {
		headers[':status'] = code
		stream.respond(headers)
	} else {
		res.writeHead(code, headers)
	}
}

function serveError(res, code, err) {
	writeHead(res, code, {
		'Content-Length': 0,
		'Cache-Control': 'max-age=0',
		'Content-Type': 'text/plain'
	})
	var data = `${code} ${ERRCODE[code]}`
	if (err) data += ', ' + err
	res.write(data)
	res.end()
}







function setCorsHeaders(headers) {
	// Website you wish to allow to connect
	headers['Access-Control-Allow-Origin'] = '*'
	// Request methods you wish to allow
	headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
	// Request headers you wish to allow
	headers['Access-Control-Allow-Headers'] = 'X-Requested-With,content-type'
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	headers['Access-Control-Allow-Credentials'] = true
}







export async function renderDirectory(desc) {
	var {fullPath, relPath} = desc
	var parentPath = getParentPath(relPath)
	var names = await fs.readdir(fullPath)
	var descriptors = names.map(name => getDescriptor(undefined, relPath, fullPath, name))
	//var descriptors = names.map(name => getDescriptorOld(fullPath, name, relPath))
	descriptors = await Promise.all(descriptors)
	var files = descriptors.filter(desc => desc.file)
	var folders = descriptors.filter(desc => desc.folder)
	function renderRow(desc) {
		var {name, size, modified, relPath} = desc
		console.log(name, relPath)
		if (modified === undefined)
			var date = ''
		else
			var date = modified.toLocaleDateString() + ' ' + modified.toLocaleTimeString()
		return `
		<tr>
			<td><a href="${relPath}">${name}</a></td>
			<td>${size}</td>
			<td>${date}</td>
		</tr>`
	}
	var rows = '<tr>' + [
		renderRow({name: '..', relPath: parentPath}),
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

export async function getDescriptor(fullPath, relPath, dir, name) {
	if (name === undefined || dir === undefined) {
		var parsed = path.parse(fullPath)
		name = parsed.base
		dir = parsed.dir
	} else if (fullPath === undefined) {
		fullPath = path.join(dir, name)
	}
	var stat = await fs.stat(fullPath)
	stat.name = name
	stat.dir = dir
	stat.dirPath = dir
	stat.relPath = relPath
	stat.fullPath = fullPath
	stat.absPath = fullPath
	stat.mime = getMime(fullPath)
	stat.folder = stat.isDirectory()
	stat.file = stat.isFile()
	stat.modified = stat.mtime
	return stat
}

async function getDescriptorOld(dir, name, relPath) {
	var fullPath = path.join(dir, name)
	var relPath = path.join(relPath, name)
	var stat = await fs.stat(fullPath)
	return {
		stat,
		name,
		fullPath,
		relPath,
		size: stat.size,
		folder: stat.isDirectory(),
		file: stat.isFile(),
		modified: stat.mtime
	}
}