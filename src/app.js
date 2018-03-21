import {computedFrom} from 'aurelia-framework'
import anchora, {AnchoraServer} from 'anchora'
import {Logger} from './logger'
import {LocalStorageProxy, localStored, observe} from './Binding'


window.anchora = anchora // todo deleteme

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


export class AnchoraApp {

	constructor() {
		window.scope = this // todo deleteme

		// Start listening to runtime errors and uncaught rejections.
		this.logger = new Logger()
		// Focus Log tab whenever error occurs and gets printed into the log.
		this.logger.onError = () => {
			if (this.$tabs)
				this.$tabs.selected = 1
		}

		this.buttonText = 'start'

		this.server = LocalStorageProxy(new AnchoraServer)

		// Also print out server's error events into the logs.
		this.server.on('error', this.logger.error)

		this.server.on('close', () => {
			this.buttonDisabled = true
			this.buttonText = 'start'
		})

		if (this.autoStart)
			this.server.listen()
	}

	attached() {
		this.$tabs = document.querySelector('flexus-tabs')
	}

	async onButtonClick() {
		if (this.server.https) {
			if (!this.server.portUnsecure)
				throw new Error('Cannot start HTTP server: HTTP port not specified')
		}
		if (this.server.https || this.server.http2) {
			if (!this.server.portSecure)
				throw new Error('Cannot start HTTPS server: HTTPS port not specified')
			if (!this.server.generateCerts && (!this.server.crtPath || !this.server.keyPath))
				throw new Error('Cannot start HTTPS server: Certificate path not specified.')
		}

		document.querySelector('flexus-tabs').selected = 1
		this.buttonDisabled = true
		if (this.server.listening) {
			this.buttonText = 'stopping'
			await this.server.close()
			this.buttonText = 'start'
		} else {
			this.buttonText = 'starting'
			await this.server.listen()
			this.buttonText = 'stop'
		}
		this.buttonDisabled = false

	}

	@observe('server.http', 'server.https', 'server.http2', 'server.portUnsecure', 'server.portSecure')
	reset() {
		if (!this.server.listening) return
		this.buttonDisabled = true
		this.buttonText = 'updating'
		clearInterval(this.resetTimeout)
		this.resetTimeout = setTimeout(async () => {
			await this.server.close()
			//await this.server.listen()
			this.buttonDisabled = false
			this.buttonText = 'start'
		})
	}

	@localStored
	autoStart = false

	@localStored
	generateCerts = true
	@observe('server.https')
	onHttpsChanged(newValue) {
		if (newValue)
			this.server.http2 = false
	}

	@observe('server.http2')
	onHttp2Changed(newValue) {
		if (newValue)
			this.server.https = false
	}

	@observe('server.allowUpgrade')
	onAllowUpgradeChanged(allowUpgrade) {
		console.log('### onAllowUpgradeChanged')
		if (allowUpgrade === false)
			this.server.forceUpgrade = false
	}

	@observe('server.forceUpgrade')
	onforceUpgradeChanged(forceUpgrade) {
		console.log('### onforceUpgradeChanged')
		if (forceUpgrade === true)
			this.server.allowUpgrade = true
	}

	@computedFrom('server.http')
	get disableUnsecureServer() {
		return !this.server.http
	}

	@computedFrom('server.https', 'server.http2')
	get disableSecureServer() {
		return !this.server.https && !this.server.http2
	}

	@computedFrom('server.cacheControl')
	get clientCacheEnabled() {
		if (!this.server.cacheControl) return true
		var cc = this.server.cacheControl.toLowerCase().trim()
		return cc !== 'no-cache'
			&& cc !== 'max-age=0'
	}

}