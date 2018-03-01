import path from 'path'
import zlib from 'zlib'
import stream from 'stream'
import {fs, MIME} from './util.mjs'


export async function openDescriptor(url, fsPath, dir, name) {
	if (name === undefined || dir === undefined) {
		var parsed = path.parse(fsPath)
		name = parsed.base
		dir = parsed.dir
	} else if (fsPath === undefined) {
		fsPath = path.join(dir, name)
		//fsPath = path.join(root, url)
	}
	var ext = getExt(name)
	var mime = getMime(ext)
	try {
		var fd = await fs.open(fsPath, 'r')
	} catch(err) {
		console.log(err)
		return
	}
	try {
		var stat = await fs.fstat(fd)
		stat.fd = fd
		stat.url = url
		stat.fsPath = fsPath
		stat.dir = dir
		stat.name = name
		stat.ext = ext
		stat.mime = mime
		stat.folder = stat.isDirectory()
		stat.file = stat.isFile()
		if (stat.folder)
			await fs.close(fd)
		else
			stat.etag = createEtag(stat)
		return stat
	} catch(err) {
		await fs.close(fd)
	}
}

export async function getDescriptor(url, fsPath, dir, name) {
	if (name === undefined || dir === undefined) {
		var parsed = path.parse(fsPath)
		name = parsed.base
		dir = parsed.dir
	} else if (fsPath === undefined) {
		fsPath = path.join(dir, name)
		//fsPath = path.join(root, url)
	}
	var ext = getExt(name)
	var mime = getMime(ext)
	try {
		var stat = await fs.stat(fsPath)
		stat.url = url
		stat.fsPath = fsPath
		stat.dir = dir
		stat.name = name
		stat.ext = ext
		stat.mime = mime
		stat.folder = stat.isDirectory()
		stat.file = stat.isFile()
		return stat
	} catch(err) {}
}

function getExt(name) {
	return path.extname(name).slice(1)
}
function getMime(ext) {
	return MIME[ext] || 'text/plain'
}

export function createEtag(stat) {
	return Buffer.from(`${stat.size}-${stat.mtimeMs}-${stat.ino}`).toString('base64')
}


export function compressStream(req, res, rawStream) {
	var acceptEncoding = req.headers['accept-encoding']
	if (!acceptEncoding)
		return rawStream
	if (acceptEncoding.includes('gzip')) {
		//A compression format using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.
		res.setHeader('content-encoding', 'gzip')
		return rawStream.pipe(zlib.createGzip())
	}
	if (acceptEncoding.includes('deflate')) {
		//A compression format using the zlib structure, with the deflate compression algorithm.
		res.setHeader('content-encoding', 'deflate')
		return rawStream.pipe(zlib.createDeflate())
	}
	/*
	if (acceptEncoding.includes('compress')) {
		//A compression format using the Lempel-Ziv-Welch (LZW) algorithm.
	}
	if (acceptEncoding.includes('br')) {
		//A compression format using the Brotli algorithm.
	}
	*/
	return rawStream
}


export function stringifyStream(originalStream, name) {
	return new Promise((resolve, reject) => {
		// Adding 'data' listener on the original stream would force it into flowing mode, the data would be read
		// once and the stream would close afterwards and become useless.
		// To make the data reusable we need to pass it into another stream and read while doing so.
		var passThrough = new stream.PassThrough
		var data = ''
		var timeout
		function onData(buffer) {
			clearTimeout(timeout)
			data += buffer.toString()
			timeout = setTimeout(onTimeout)
		}
		function onTimeout() {
			clearTimeout(timeout)
			originalStream.removeListener('data', onData)
			originalStream.removeListener('end', onTimeout)
			originalStream.removeListener('error', onTimeout)
			resolve([passThrough, data])
		}
		originalStream.on('data', onData)
		// Node has limit of 80kb somewhere in streams or fs leading to lost 'end' events.
		// Timeouts are utilized to work around it (where needed, smaller files end up firing 'end' event).
		originalStream.once('end', onTimeout)
		originalStream.once('error', onTimeout)
		originalStream.pipe(passThrough)
	})
}

async function handleFile(req, res, desc, options) {
	if (options.encoding !== false) {
		var gzDesc = await getDescriptor(desc.url, desc.fsPath + '.gz', desc.dir, desc.name)
		if (gzDesc !== undefined) {
			var fileStream = gzDesc
		} else if (options.encoding === 'active') {
			var fileStream = desc
			fileStream = compressStream(req, res, fileStream)
		}
	} else {
		var fileStream = desc
	}
	if (fileStream !== undefined) {
		fileStream.pipe(res)
	}
}

export function openReadStream(desc, range) {
	var streamOptions = {
		fd: desc.fd,
		flags: 'r',
	}
	if (range)
		Object.assign(streamOptions, range)
	return fs.createReadStream(desc.fsPath, streamOptions)
}

function parseRange() {
	// TODO
	var start, end, length
	return {start, end, length}
}