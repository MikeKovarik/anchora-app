(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('http'), require('url'), require('path'), require('etag'), require('fs'), require('util'), require('events')) :
	typeof define === 'function' && define.amd ? define(['exports', 'http', 'url', 'path', 'etag', 'fs', 'util', 'events'], factory) :
	(factory((global.fileserv = {}),global.http,global.url,global.path,global.etag,global.fs,global.util,global.events));
}(this, (function (exports,http,url,pathModule,etag,fsSync,util,events) { 'use strict';

http = http && http.hasOwnProperty('default') ? http['default'] : http;
url = url && url.hasOwnProperty('default') ? url['default'] : url;
pathModule = pathModule && pathModule.hasOwnProperty('default') ? pathModule['default'] : pathModule;
etag = etag && etag.hasOwnProperty('default') ? etag['default'] : etag;
fsSync = fsSync && fsSync.hasOwnProperty('default') ? fsSync['default'] : fsSync;

var fs = {
	exists: util.promisify(fsSync.exists),
	access: util.promisify(fsSync.access),
	readdir: util.promisify(fsSync.readdir),
	readFile: util.promisify(fsSync.readFile),
	stat: util.promisify(fsSync.stat),
	createReadStream: fsSync.createReadStream,
};

const MIME = {
	html: 'text/html',
	jpeg: 'image/jpeg',
	jpg:  'image/jpeg',
	png:  'image/png',
	js:   'text/javascript',
	mjs:  'text/javascript',
	css:  'text/css'
};

const ERRCODE = {
	404: 'Not found',
	500: 'Internal Server Error',
	403: 'Forbidden',
};

class HttpHostServer extends http.Server {

	constructor() {
		super();
		this.on('request', this._onRequest.bind(this));
	}

	async _onRequest(req, res) {
		var linkPath = req.url.split('/')
			.map(section => decodeURI(section))
			.join('/');
		var diskPath = pathModule.join(this._root, linkPath);

		try {
			var stat = await fs.stat(diskPath);
		} catch(err) {
			this.serveError(res, 404);
			return
		}

		try {
			if (stat.isDirectory()) {
				var names = await fs.readdir(diskPath);
				if (names.includes('index.html')) {
					// redirect to index.html
					res.writeHead(302, {
						'Location': pathModule.join(linkPath, 'index.html')
					});
					res.end();
				} else {
					// render list of files inside the folder
					res.writeHead(200, {
						'Content-Type': 'text/html'
					});
					res.write(await this.renderDirectory(diskPath, linkPath));
					res.end();
				}
			} else if (stat.isFile()) {
				// return the file
				var headers = {
					'ETag': etag(stat),
					'Content-Type': getMimeFromPath(diskPath),
					'Content-Length': stat.size,
				};
				// If the user provided a max-age for caching, add the cache header.
				if (this.maxAge)
					headers['Cache-Control'] = 'max-age=' + this.maxAge;
				res.writeHead(200, headers);
				var stream = fs.createReadStream(diskPath);
				stream.on('error', err => this.serveError(res, 500, err));
				stream.pipe(res);
			}
		} catch(err) {
			console.error('caught error', err);
			this.serveError(res, 500, err);
		}

	}

	serveError(res, num, err) {
		res.writeHead(num, {
            'Content-Length': 0,
            'Cache-Control': 'max-age=0',
			'Content-Type': 'text/plain'
		});
		var data = `${num} ${ERRCODE[num]}`;
		if (err) data += ', ' + err;
		res.write(data);
		res.end();
	}

	async renderDirectory(diskPath, linkPath) {
		var parentPath = getParentPath(linkPath);
		var names = await fs.readdir(diskPath);
		var descriptors = names.map(name => this.getDescriptor(diskPath, name, linkPath));
		descriptors = await Promise.all(descriptors);
		var files = descriptors.filter(desc => desc.file);
		var folders = descriptors.filter(desc => desc.folder);
		function renderRow(desc) {
			var {name, size, modified} = desc;
			if (modified === undefined)
				var date = '';
			else
				var date = modified.toLocaleDateString() + ' ' + modified.toLocaleTimeString();
			return `
			<tr>
				<td><a href="${desc.linkPath}">${name}</a></td>
				<td>${size}</td>
				<td>${date}</td>
			</tr>`
		}
		var rows = '<tr>' + [
			renderRow({name: '..', linkPath: parentPath}),
			...folders.map(renderRow),
			...files.map(renderRow)
		].join('\n') + '</tr>';

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

	async getDescriptor(dir, name, linkPath) {
		var diskPath = pathModule.join(dir, name);
		var linkPath = pathModule.join(linkPath, name);
		var stat = await fs.stat(diskPath);
		return {
			name,
			diskPath,
			linkPath,
			size: stat.size,
			folder: stat.isDirectory(),
			file: stat.isFile(),
			modified: stat.mtime
		}
	}



}

function getParentPath(path) {
	var sections = path.split('/');
	sections.pop();
	return sections.join('/') || '/'
}

function getExtension(path) {
	return pathModule.extname(path).slice(1)
}

function getMimeFromPath(path) {
	return MIME[getExtension(path)] || 'text/plain'
}

var server = new HttpHostServer;

/*
var $log = document.querySelector('#log')

var _log = console.log.bind(console)
console.log = function(...args) {
	_log(...args)
	$log.innerHTML += args.map(data => JSON.stringify(data, null, 4)).join(', ') + '\n'
}
*/


class FileServApp extends events.EventEmitter {

	constructor() {
		super();
		this.server = server;

		this.updateStatusUi = this.updateStatusUi.bind(this);
		this.start = this.start.bind(this);
		this._start = this._start.bind(this);
		this.stop = this.stop.bind(this);
		this._stop = this._stop.bind(this);
		this.restart = this.restart.bind(this);

		this.server.on('listening', () => this.status = 'running');
		this.server.on('error', () => this.status = 'error');
		this.server.on('close', () => {
			if (this.status !== 'restarting')
				this.status = 'stopped';
		});
		this.server.on('error', err => console.error('SERVER ERR', err));

		this.$port = document.querySelector('#port');
		this.$root = document.querySelector('#root');
		this.$start = document.querySelector('#start');
		this.$stop = document.querySelector('#stop');
		this.$status = document.querySelector('#status');
		this.$autostart = document.querySelector('#autostart');

		// Launched with argument to host specific folder
		if (process.argv.length > 1)
			this.root = process.argv[1];

		// Bind this.port to port input element and try to pull settings from localstorage.
		this.bindInput('port', parseInt, Number.isSafeInteger, 80);
		this.bindInput('root', a => a, a => true, 'C\\htdocs');
		this.bindCheckbox('autostart', true);

		this.$start.addEventListener('click', this.start);
		this.$stop.addEventListener('click', this.stop);

		this.updateStatusUi();

		if (this.autostart)
			this.start();
	}

	get running() {
		return this.server.listening
	}

	get status() {
		return this._status || 'stopped'
	}
	set status(newValue) {
		this._status = newValue;
		this.updateStatusUi();
	}

	updateStatusUi() {
		var status = this.status;
		var color;
		if (status === 'running')
			color = 'green';
		else if (status === 'stopped' || status === 'error')
			color = 'red';
		else
			color = 'orange';
		this.$status.setAttribute('foreground', color);
		this.$status.textContent = status;
		if (status === 'running') {
			this.$status.animate({opacity: [0,1]}, 100);
		}
		if (this.running) {
			this.$start.hidden = true;
			this.$stop.hidden = false;
		} else {
			this.$start.hidden = false;
			this.$stop.hidden = true;
		}
		if (color === 'orange') {
			this.$start.disabled = true;
			this.$stop.disabled = true;
		} else {
			this.$start.disabled = false;
			this.$stop.disabled = false;
		}
	}


	restart() {
		if (this.running) {
			this.stop();
			this.status = 'restarting';
			this.server.once('close', this._start);
		}
	}

	start() {
		this.status = 'starting';
		this._start();
	}
	_start() {
		this.server._root = this.root;
		this.server.listen(this.port);
	}

	stop() {
		this.status = 'stopping';
		this._stop();
	}
	_stop() {
		this.server.close();
	}


	bindInput(name, parser, validator, defaultVal) {
		var node = this['$' + name];
		var binding = new Binding({scope: this, name, node, parser, defaultVal});
		node.value = binding.get();
		node.addEventListener('change', e => {
			var value = parser(node.value);
			if (validator(value)) {
				node.removeAttribute('invalid');
				binding.set(value);
				this.restart();
			} else {
				node.setAttribute('invalid', '');
			}
		});
		//node.addEventListener('blur', e => {
		//	node.value = this[name]
		//})
	}

	bindCheckbox(name, defaultVal) {
		var node = this['$' + name];
		var binding = new Binding({scope: this, name, node, defaultVal});
		//node.checked = binding.get()
		//node.addEventListener('change', e => binding.set(node.checked))
	}

}

class Binding {

	constructor(options) {
		var {scope, name, node, parser, defaultVal} = options;

		if (node && !parser) {
			switch (node.type) {
				case 'checkbox':
					parser = parseBoolean;
					break
				case 'number':
					parser = parseInt;
					break
			}
		}

		this.name = name;
		this.parser = parser;
		this.scope = scope;
		this.node = node;

		if (isNotValue(scope[name]) && parser)
			scope[name] = parser(localStorage[name]);
		if (isNotValue(scope[name]))
			scope[name] = defaultVal;

		if (node) {
			this.type = node.type;
			node.checked = this.get();
			node.addEventListener('change', e => this.onChange());
		}

	}

	onChange() {
		if (this.type === 'checkbox')
			var value = this.node.checked;
		else
			var value = this.node.value;
		if (this.parser)
			value = this.parser(value);
		this.set(value);
	}

	get() {
		var {name, scope} = this;
		return scope[name]
	}

	set(newValue) {
		console.log('set', newValue);
		var {name, scope} = this;
		scope[name] = localStorage[name] = newValue;
	}

}

function isNotValue(value) {
	return value === undefined
		|| value === null
		|| Number.isNaN(value)
}

function parseBoolean(value) {
	if (value === 'true'  || value === true)  return true
	if (value === 'false' || value === false) return false
}

window.app = new FileServApp;

Object.defineProperty(exports, '__esModule', { value: true });

})));
