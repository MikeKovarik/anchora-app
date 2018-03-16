import {computedFrom, observable, inject, BindingEngine} from 'aurelia-framework'
import anchora, {AnchoraServer} from 'anchora'
import {Logger} from './logger'
import {AnchoraBinding, LocalStorageBinding, LocalStorageProxy, localStored} from './Binding'


window.anchora = anchora

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


@inject(BindingEngine)
export class AnchoraApp {

	@localStored
	autoStart = false

	constructor(bindingEngine) {
		window.scope = this

		// Start listening to runtime errors and uncaught rejections.
		this.logger = new Logger()
		// Focus Log tab whenever error occurs and gets printed into the log.
		this.logger.onError = () => {
			if (this.$tabs)
			this.$tabs.selected = 1
		}

		this.buttonText = 'start'

		this.server = LocalStorageProxy(new AnchoraServer, {
			https(newValue) {
				if (newValue)
					this.http2 = false
			},
			http2(newValue) {
				if (newValue)
					this.https = false
			},
			portUnsecure(newValue) {
				console.log('portUnsecure', newValue, this)
			},
			portSecure(newValue) {
				console.log('portSecure', newValue, this)
			},
		})
/*		
		this.server = anchoraBinding

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
*/

		this.server.setup()

	}

	// Bind input fields to localStorage and apply previously stored options.
	// Note: needed to be done once attached to dom to be able to dynamically
	// load all anchora's input fields (yup, I'm lazy to type it all out)
	attached() {
		this.$tabs = document.querySelector('flexus-tabs')
		// Load app settings from localStorage
		new LocalStorageBinding(this, ['autoStart'])
		// Load anchora server settings from localStorage
		//new LocalStorageBinding(this.server, this.anchora)		
		// Load anchora server settings from localStorage
		new LocalStorageBinding(this.logger, ['format', 'includeStack', 'includeTimestamp'])
		//if (this.autoStart)
		//	this.server.listen()
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
			console.log('await this.server.close()')
			this.buttonText = 'stopping'
			await this.server.close()
			this.buttonText = 'start'
			console.log('await this.server.close() done')
		} else {
			console.log('await this.server.listen()')
			this.buttonText = 'starting'
			await this.server.listen()
			this.buttonText = 'stop'
			console.log('await this.server.listen() done')
		}
		this.buttonDisabled = false

	}

}