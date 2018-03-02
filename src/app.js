import {computedFrom, observable, inject, BindingEngine} from 'aurelia-framework'
import anchora from 'anchora'
import {Logger} from './logger'
import {AnchoraBinding} from './AnchoraBinding'


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

@inject(BindingEngine, AnchoraBinding)
export class AnchoraApp {

	attached() {
		this.$tabs = document.querySelector('flexus-tabs')
	}

	constructor(bindingEngine, server) {
		window.scope = this

		this.server = server

		// Start listening to runtime errors and uncaught rejections.
		this.logger = new Logger()
		// Focus Log tab whenever error occurs and gets printed into the log.
		this.logger.onError = () => {
			if (this.$tabs)
				this.$tabs.selected = 1
		}
		// Also print out server's error events into the logs.
		this.server.on('error', err => {
			this.status = 'error'
			this.logger.error(err)
		})

		this.server.on('listening', () => this.status = 'running')
		this.server.on('close', () => {
			if (this.status !== 'restarting')
				this.status = 'stopped'
		})

		// Hook into Anchora's logger. It uses 'debug' module by default
		// but those messages could be rerouted to app's DOM logger.
		bindingEngine
			.propertyObserver(this.logger, 'format')
			.subscribe(format => {
				if (format === 'all')
					anchora.changeDebugger(this.logger.log)
				else
					anchora.resetDebugger()
			})

		bindingEngine
			.propertyObserver(this.server, 'cacheControl')
			.subscribe((newValue, oldValue) => {
				console.log('cacheControl', newValue, oldValue)
			})

		this.buttonText = 'start'

		//if (this.autoStart)
		//	this.server.listen()
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
			this.logger.log('starting')
		}
		if (this.buttonText === 'stop') {
			this.buttonText = 'stopping'
			this.logger.log('stopping')
		}
		await promiseTimeout(699)
		if (this.buttonText === 'starting') {
			this.buttonText = 'stop'
			this.logger.log('running')
		}
		if (this.buttonText === 'stopping') {
			this.buttonText = 'start'
			this.logger.log('stopped')
		}
		this.buttonDisabled = false
	}

	@observable
	autoStart = parseInt(localStorage.autoStart) || 443
	autoStartChanged(newValue) {
		console.log('autoStartChanged', newValue)
		localStorage.autoStart = newValue
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
*/
}
