import http from 'http'
import url from 'url'
import pathModule from 'path'
import etag from 'etag'
import {fs, MIME, ERRCODE, getMime, getParentPath} from './util.mjs'



class HttpHostServer extends http.Server {

	constructor() {
		super()
		this.on('request', this._onRequest.bind(this))
	}

	async _onRequest(req, res) {
		var relPath = req.url.split('/')
			.map(section => decodeURI(section))
			.join('/')
		var fullPath = pathModule.join(this._root, relPath)

		try {
			var stat = await fs.stat(fullPath)
		} catch(err) {
			this.serveError(res, 404)
			return
		}

		try {
			if (stat.isDirectory()) {
				var names = await fs.readdir(fullPath)
				if (names.includes('index.html')) {
					// redirect to index.html
					res.writeHead(302, {
						'Location': pathModule.join(relPath, 'index.html')
					})
					res.end()
				} else {
					// render list of files inside the folder
					res.writeHead(200, {
						'Content-Type': 'text/html'
					})
					res.write(await this.renderDirectory(fullPath, relPath))
					res.end()
				}
			} else if (stat.isFile()) {
				// return the file
				var headers = {
					'ETag': etag(stat),
					'Content-Type': getMime(fullPath),
					'Content-Length': stat.size,
				}
				// If the user provided a max-age for caching, add the cache header.
				if (this.maxAge)
					headers['Cache-Control'] = 'max-age=' + this.maxAge
				res.writeHead(200, headers)
				var stream = fs.createReadStream(fullPath)
				stream.on('error', err => this.serveError(res, 500, err))
				stream.pipe(res)
			}
		} catch(err) {
			console.error('caught error', err)
			this.serveError(res, 500, err)
		}

	}

	serveError(res, num, err) {
		res.writeHead(num, {
            'Content-Length': 0,
            'Cache-Control': 'max-age=0',
			'Content-Type': 'text/plain'
		})
		var data = `${num} ${ERRCODE[num]}`
		if (err) data += ', ' + err
		res.write(data)
		res.end()
	}

	async renderDirectory(fullPath, relPath) {
		var parentPath = getParentPath(relPath)
		var names = await fs.readdir(fullPath)
		var descriptors = names.map(name => this.getDescriptor(fullPath, name, relPath))
		descriptors = await Promise.all(descriptors)
		var files = descriptors.filter(desc => desc.file)
		var folders = descriptors.filter(desc => desc.folder)
		function renderRow(desc) {
			var {name, size, modified} = desc
			if (modified === undefined)
				var date = ''
			else
				var date = modified.toLocaleDateString() + ' ' + modified.toLocaleTimeString()
			return `
			<tr>
				<td><a href="${desc.relPath}">${name}</a></td>
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

	async getDescriptor(dir, name, relPath) {
		var fullPath = pathModule.join(dir, name)
		var relPath = pathModule.join(relPath, name)
		var stat = await fs.stat(fullPath)
		return {
			name,
			fullPath,
			relPath,
			size: stat.size,
			folder: stat.isDirectory(),
			file: stat.isFile(),
			modified: stat.mtime
		}
	}



}

export var server = new HttpHostServer
