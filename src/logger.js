import {observable} from 'aurelia-framework'
import {localStored} from './Binding'


export class Logger {

	list = []
	
	@localStored
	includeStack = false

	@localStored
	includeTimestamp = true

	@localStored
	@observable
	format = 'errors'

	constructor(app) {

		// Tap into console.log and console.error
		this.originalLog = console._log = console.log.bind(console)
		this.originalWarn = console._warn = console.warn.bind(console)
		this.originalError = console._error = console.error.bind(console)

		this.log = this.log.bind(this)
		this.warn = this.warn.bind(this)
		this.error = this.error.bind(this)

		this.formatChanged()

		// Handle Node errors
		if (typeof process !== 'undefined') {
			process.on('unhandledRejection', reason => {
				// Stringify the error and push it out.
				this._handleUnhandledRejection(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('NODE unhandledRejection:', reason)
			})
			process.on('uncaughtException', reason => {
				// Stringify the error and push it out.
				this._handleUnhandledRejection(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('NODE uncaughtException:', reason)
			})
		}

		// Handle browser uncaught rejections.
		if (typeof window !== 'undefined') {
			window.addEventListener('unhandledrejection', event => {
				// Error's reason can be a bit tricky to find, depending what caused it.
				var reason = event.reason || event.detail && event.detail.reason
				// Prevent error output on the console:
				event.preventDefault()
				// Stringify the error and push it out.
				this._handleUnhandledRejection(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('BROWSER unhandledrejection:', reason)
			})
		}

	}

	formatChanged(format = this.format) {
		if (format === 'errors') {
			console.log = this.originalLog
			console.warn = this.warn
			console.error = this.error
		} else {
			console.log = this.log
			console.warn = this.warn
			console.error = this.error
		}
	}

	_handleUnhandledRejection(reason) {
		if (typeof reason === 'string') {
			this._error(reason)
		} else if (reason instanceof Error) {
			if (this.includeStack)
				this._error(reason.message + '\n' + (reason.stack || ''))
			else
				this._error(reason.message)
		} else {
			this._error(JSON.stringify(reason))
		}
	}

	_getTimestamp() {
		var date = new Date()
		return date.getHours().toString().padStart(2, '0')
		+ ':' + date.getMinutes().toString().padStart(2, '0')
		+ ':' + date.getSeconds().toString().padStart(2, '0')
	}

	_getLogMessage(args) {
		return args
			.map(arg => arg === undefined ? 'undefined' : JSON.stringify(arg))
			.join(', ')
	}

	log(...args) {
		this.originalLog(...args)
		this.list.unshift({
			timestamp: this._getTimestamp(),
			message: this._getLogMessage(args),
		})
	}

	warn(...args) {
		this.originalWarn(...args)
		this.list.unshift({
			color: 'orange',
			timestamp: this._getTimestamp(),
			message: this._getLogMessage(args),
		})
	}

	error(...args) {
		this.originalError(...args)
		this._error(this._getLogMessage(args))
	}
	_error(message) {
		this.list.unshift({
			color: 'red',
			timestamp: this._getTimestamp(),
			message,
		})
		if (this.onError)
			this.onError()
	}

}

