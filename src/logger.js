import {observable} from 'aurelia-framework'
import {localStored} from './Binding'


var isNode = typeof global !== 'undefined'

function stringify(data) {
	if (data === undefined)
		return 'undefined'
	if (data === null)
		return 'null'
	if (typeof data === 'object')
		return JSON.stringify(data)
	else if (data.toString)
		return data.toString()
	else
		return data
}

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

		this.log = this.log.bind(this)
		this.warn = this.warn.bind(this)
		this.error = this.error.bind(this)

		// Tap into console.log and console.error
		this.originalLog = console._log = console.log.bind(console)
		this.originalWarn = console._warn = console.warn.bind(console)
		this.originalError = console._error = console.error.bind(console)

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
			var nodeConsole = this.nodeConsole = global.console
			nodeConsole._log = nodeConsole.log.bind(nodeConsole)
			nodeConsole._warn = nodeConsole.warn.bind(nodeConsole)
			nodeConsole._error = nodeConsole.error.bind(nodeConsole)
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
			var browserConsole = this.browserConsole = window.console
			browserConsole._log = browserConsole.log.bind(browserConsole)
			browserConsole._warn = browserConsole.warn.bind(browserConsole)
			browserConsole._error = browserConsole.error.bind(browserConsole)
		}

		this.formatChanged()

	}

	formatChanged(format = this.format) {
		var {browserConsole, nodeConsole} = this
		if (!format) {
			if (browserConsole) {
				browserConsole.log = browserConsole._log
				browserConsole.warn = browserConsole._warn
				browserConsole.error = browserConsole._error
			}
			if (nodeConsole) {
				nodeConsole.log = nodeConsole._log
				nodeConsole.warn = nodeConsole._warn
				nodeConsole.error = nodeConsole._error
			}
		} else if (format === 'errors') {
			if (browserConsole) {
				browserConsole.log = browserConsole._log
				browserConsole.warn = this.warn
				browserConsole.error = this.error
			}
			if (nodeConsole) {
				nodeConsole.log = nodeConsole._log
				nodeConsole.warn = this.warn
				nodeConsole.error = this.error
			}
		} else {
			if (browserConsole) {
				browserConsole.log = this.log
				browserConsole.warn = this.warn
				browserConsole.error = this.error
			}
			if (nodeConsole) {
				nodeConsole.log = this.log
				nodeConsole.warn = this.warn
				nodeConsole.error = this.error
			}
		}
	}

	_handleUnhandledRejection(reason) {
		// WARNING: Can't do 'reason instanceof Error' because error's from node's context don't
		// use the same Error object. Name comparison is the only safe way
		if (typeof reason === 'string') {
			this._error(reason)
		} else if (reason.constructor.name === 'Error') {
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
		return args.map(stringify).join(', ')
	}

	log(...args) {
		if (this.browserConsole)
			this.browserConsole._log(...args)
		if (this.nodeConsole)
			this.nodeConsole._log(...args)
		this.list.push({
			timestamp: this._getTimestamp(),
			message: this._getLogMessage(args),
		})
		if (this.onLog)
			this.onLog()
	}

	warn(...args) {
		if (this.browserConsole)
			this.browserConsole._warn(...args)
		if (this.nodeConsole)
			this.nodeConsole._warn(...args)
		this.list.push({
			color: 'orange',
			timestamp: this._getTimestamp(),
			message: this._getLogMessage(args),
		})
		if (this.onWarn)
			this.onWarn()
	}

	error(...args) {
		if (this.browserConsole)
			this.browserConsole._error(...args)
		if (this.nodeConsole)
			this.nodeConsole._error(...args)
		this._error(this._getLogMessage(args))
	}
	_error(message) {
		this.list.push({
			color: 'red',
			timestamp: this._getTimestamp(),
			message,
		})
		if (this.onError)
			this.onError()
	}

}

