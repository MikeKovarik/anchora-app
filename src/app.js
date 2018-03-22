import path from 'path'
import {computedFrom, inject, observable} from 'aurelia-framework'
import anchora, {AnchoraServer} from 'anchora'
import {Logger} from './logger'
import {LocalStorageBinding, localStored, observe} from './Binding'


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


class Anchora extends LocalStorageBinding {

	// Storing default certificate in %AppData%
	// NOTE: Windows store apps don't have write permissions to cwd.
	certDir = path.join(process.env.LOCALAPPDATA, 'anchora')

	constructor() {
		super()
		this.target = new AnchoraServer
		this.setupBinding()
	}

	@computedFrom('cacheControl')
	get clientCacheEnabled() {
		if (!this.cacheControl) return true
		var cc = this.cacheControl.toLowerCase().trim()
		return cc !== 'no-cache'
			&& cc !== 'max-age=0'
	}


	@computedFrom('http')
	get unsecure() {
		return this.http
	}

	@computedFrom('https', 'http2')
	get secure() {
		return this.https || this.http2
	}


	@observable
	https
	httpsChanged(newValue) {
		if (newValue)
			this.http2 = false
	}

	@observable
	http2
	http2Changed(newValue) {
		if (newValue)
			this.https = false
	}

	@observable
	allowUpgrade
	allowUpgradeChanged(allowUpgrade) {
		if (allowUpgrade === false)
			this.forceUpgrade = false
	}

	@observable
	forceUpgrade
	forceUpgradeChanged(forceUpgrade) {
		if (forceUpgrade === true)
			this.allowUpgrade = true
	}

}



export class AnchoraApp {

	constructor() {
		this.checkIfRunning = this.checkIfRunning.bind(this)

		this.buttonText = 'start'

		this.server = new Anchora

		// Start listening to runtime errors and uncaught rejections (and hijacks console.* methods).
		this.logger = new Logger
		// Focus Log tab whenever error occurs and gets printed into the log.
		this.logger.onError = () => {
			this.scrollLog()
			if (this.$tabs)
				this.$tabs.selected = 1
		}
		// Keep scrolling to bottom of logger window with each log
		this.logger.onLog = this.logger.onWarn = this.scrollLog.bind(this)
		// Replace anchora's internal debug() method with our logger that pipes the logs into DOM.
		this.changeDebugLogger()

		// Also print out server's error events into the logs.
		this.server.on('error', () => {
			this.logger.error()
			this.checkIfRunning()
		})

		this.server.on('close', () => {
			this.buttonText = 'start'
		})

		if (this.autoStart)
			this.server.listen()

		// Server runs in another process and can't be observed so we're subjected to polling.
		setInterval(this.checkIfRunning, 5000)

	}

	scrollLog() {
		if (this.$log) {
			this.$log.scrollTop = Number.MAX_SAFE_INTEGER
			setTimeout(() => this.$log.scrollTop = Number.MAX_SAFE_INTEGER)
		}
	}

	checkIfRunning() {
		if (this.server.listening && this.buttonText !== 'stop')
			this.buttonText = 'stop'
		else if (!this.server.listening && this.buttonText !== 'start')
			this.buttonText = 'start'
	}

	attached() {
		this.$tabs = document.querySelector('flexus-tabs')
	}

	async onButtonClick() {
		document.querySelector('flexus-tabs').selected = 1
		if (this.server.listening) {
			this.buttonText = 'stopping'
			await this.server.close()
			this.buttonText = 'start'
		} else {
			this.buttonText = 'starting'
			await this.server.listen()
			this.buttonText = 'stop'
		}

	}

	@observe('server.http', 'server.https', 'server.http2', 'server.portUnsecure', 'server.portSecure')
	reset() {
		if (!this.server.listening) return
		this.buttonText = 'restarting'
		clearInterval(this.resetTimeout)
		this.resetTimeout = setTimeout(async () => {
			await this.server.close()
			this.buttonText = 'starting'
			await this.server.listen()
			this.buttonText = 'stop'
		})
	}

	@observe('logger.format')
	changeDebugLogger() {
		if (this.logger.format === 'all')
			anchora.changeDebugger(this.logger.log)
		else
			anchora.resetDebugger()
	}

	@localStored
	autoStart = false

	@localStored
	generateCerts = true

}