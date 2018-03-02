import {computedFrom, observable} from 'aurelia-framework'
import anchora from 'anchora'
import {logs, log} from './logger'


// TODO, future ideas
// - Custom domains (edits hosts file, serves contet from different root)
// - Launch from context menu - Right click in folder "host this folder"

// TODO: doesnt work again
if (window.nw) {
	// Force NWJS to open <a> links in browser.
	var win = window.nw.Window.get()
	win.on('new-win-policy', (frame, url, policy) => {
		nw.Shell.openExternal(url)
		policy.ignore()
	})
}

var promiseTimeout = (millis = 0) => new Promise(resolve => setTimeout(resolve, millis))

export class AnchoraApp {

	constructor() {
		window.scope = this
		this.options = {}
		this.logs = logs
		this.server = anchora.createServer(this.options)
		this.server.on('error', err => {
			this.status = 'error'
			log(err)
		})
		//this.server.on('error', err => console.error('SERVER ERR', err))

		this.server.on('listening', () => this.status = 'running')
		this.server.on('error', () => this.status = 'error')
		this.server.on('close', () => {
			if (this.status !== 'restarting')
				this.status = 'stopped'
		})

		this.loadValues()

		if (this.autoStart)
			this.start()
	}

	loadValues() {
		// Launched with argument to host specific folder
		// TODO: make this not affect the default root stored in localstorage
		//       because this will is a one-off instance launched through context menu
		if (typeof process !== 'undefined' && process.argv.length > 1)
			this.root = process.argv[1]
		// Load stores values from localstorage or set default (on first launch)
		if (this.http2)
			this.https = false
		if (localStorage.http2 === undefined && localStorage.https === undefined) {
			// First launch. preffer HTTP2 over HTTPS
			this.http2 = true
			this.https = false
		}
		this.running = false
		this.buttonText = 'start'
		this.autoStart = localStorage.autoStart || true
	}

	@observable
	httpPort = parseInt(localStorage.httpPort) || 80
	httpPortChanged(newValue, oldValue) {
		localStorage.httpPort = this.httpPort
	}

	@observable
	httpsPort = parseInt(localStorage.httpsPort) || 443
	httpsPortChanged(newValue, oldValue) {
		localStorage.httpsPort = this.httpsPort
	}

	@observable
	http = localStorage.http === 'true'
	httpChanged(newValue, oldValue) {
		localStorage.http = this.http
	}

	@observable
	https = localStorage.https === 'true'
	httpsChanged(newValue, oldValue) {
		console.log('httpsChanged')
		localStorage.https = this.https
		if (this.https)
			this.http2 = false
	}

	@observable
	http2 = localStorage.http2 === 'true'
	http2Changed(newValue, oldValue) {
		console.log('http2Changed')
		localStorage.http2 = this.http2
		if (this.http2)
			this.https = false
	}

	@observable
	root = localStorage.root || 'C\\htdocs'
	rootChanged(newValue, oldValue) {
		localStorage.root = this.root
	}

	@computedFrom('status')
	get statusColor() {
		var status = this.status
		if (status === 'running') return 'green'
		if (status === 'stopped') return 'gray'
		if (status === 'error')   return 'red'
		return 'orange'
	}

	async onButtonClick() {
		if (this.https) {
			if (!this.httpPort)
				throw new Error('Cannot start HTTP server: HTTP port not specified')
		}
		if (this.https || this.http2) {
			if (!this.generateCerts && (!this.crtPath || !this.keyPath))
				throw new Error('Cannot start HTTPS server: Certificate path not specified.')
			if (!this.httpsPort)
				throw new Error('Cannot start HTTPS server: HTTPS port not specified')
		}

		document.querySelector('flexus-tabs').selected = 1
		this.buttonDisabled = true
		if (this.buttonText === 'start') {
			this.buttonText = 'starting'
			log('starting')
		}
		if (this.buttonText === 'stop') {
			this.buttonText = 'stopping'
			log('stopping')
		}
		await promiseTimeout(699)
		if (this.buttonText === 'starting') {
			this.buttonText = 'stop'
			log('running')
		}
		if (this.buttonText === 'stopping') {
			this.buttonText = 'start'
			log('stopped')
		}
		this.buttonDisabled = false
	}

/*
	@computedFrom('this.server.listening')
	get running() {
		return this.server.listening
	}

	get status() {
		return this._status || 'stopped'
	}
	set status(newValue) {
		this._status = newValue
		this.updateStatusUi()
	}

	restart() {
		if (this.running) {
			this.stop()
			this.status = 'restarting'
			this.server.once('close', this._start)
		}
	}
*/
	start() {
		this.status = 'starting'
		this._start()
	}
	_start() {
		this.server._root = this.root
		this.server.listen()
	}

	stop() {
		this.status = 'stopping'
		this._stop()
	}
	_stop() {
		this.server.close()
	}

}
