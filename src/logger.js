import {observable} from 'aurelia-framework'
import {localStored} from './Binding'


var isBrowser = typeof navigator !== 'undefined'
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

	constructor() {

		this.log = this.log.bind(this)
		this.warn = this.warn.bind(this)
		this.error = this.error.bind(this)
		this.handleWarning = this.handleWarning.bind(this)

		// Tap into console.log and console.error
		this.originalLog = console._log = console.log.bind(console)
		this.originalWarn = console._warn = console.warn.bind(console)
		this.originalError = console._error = console.error.bind(console)

		// Handle Node errors
		if (typeof process !== 'undefined') {
			var nodeConsole = this.nodeConsole = global.console
			nodeConsole._log = nodeConsole.log.bind(nodeConsole)
			nodeConsole._warn = nodeConsole.warn.bind(nodeConsole)
			nodeConsole._error = nodeConsole.error.bind(nodeConsole)
			process.on('unhandledRejection', reason => {
				// Stringify the error and push it out.
				this.handleError(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('NODE unhandledRejection:', reason)
			})
			process.on('uncaughtException', reason => {
				// Stringify the error and push it out.
				this.handleError(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('NODE uncaughtException:', reason)
			})
			process.on('warning', this.handleWarning)
		}

		// Handle browser uncaught rejections.
		if (typeof window !== 'undefined') {
			var browserConsole = this.browserConsole = window.console
			browserConsole._log = browserConsole.log.bind(browserConsole)
			browserConsole._warn = browserConsole.warn.bind(browserConsole)
			browserConsole._error = browserConsole.error.bind(browserConsole)
			window.addEventListener('unhandledrejection', event => {
				// Error's reason can be a bit tricky to find, depending what caused it.
				var reason = event.reason || event.detail && event.detail.reason
				// Prevent error output on the console:
				event.preventDefault()
				// Stringify the error and push it out.
				this.handleError(reason)
				// Log the full unchanged error object to console with default console.error
				this.originalError('BROWSER unhandledrejection:', reason)
			})
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

	_getTimestamp() {
		var date = new Date()
		return date.getHours().toString().padStart(2, '0')
		+ ':' + date.getMinutes().toString().padStart(2, '0')
		+ ':' + date.getSeconds().toString().padStart(2, '0')
	}

	_stringifyLogArguments(args) {
		return args.map(stringify).join(' ').trim()
	}

	log(...args) {
		if (this.browserConsole)
			this.browserConsole._log(...args)
		if (this.nodeConsole)
			this.nodeConsole._log(...args)
		this._createLog(this._stringifyLogArguments(args))
	}
	_createLog(message) {
		this.list.push({
			timestamp: this._getTimestamp(),
			message,
		})
		if (this.onLog)
			this.onLog()
	}

	warn(...args) {
		if (this.browserConsole)
			this.browserConsole._warn(...args)
		if (this.nodeConsole)
			this.nodeConsole._warn(...args)
		this._createWarning(this._stringifyLogArguments(args))
	}
	_createWarning(message) {
		var item = {
			color: 'orange',
			timestamp: this._getTimestamp(),
			message,
		}
		if (this.onBeforeWarn)
			if (this.onBeforeWarn(item) === false)
				return
		this.list.push(item)
		if (this.onWarn)
			this.onWarn(item)
	}

	error(...args) {
		if (this.browserConsole)
			this.browserConsole._error(...args)
		if (this.nodeConsole)
			this.nodeConsole._error(...args)
		this._createError(this._stringifyLogArguments(args))
	}
	_createError(message) {
		var item = {
			color: 'red',
			timestamp: this._getTimestamp(),
			message,
		}
		if (this.onBeforeError)
			if (this.onBeforeError(item) === false)
				return
		this.list.push(item)
		if (this.onError)
			this.onError(item)
	}

	_handleErrorLikeObject(object) {
		if (typeof object === 'string') {
			return object
		} else if ((isBrowser && object instanceof window.Error) || isNode && object instanceof global.Error) {
			if (this.includeStack)
				return object.message + '\n' + (object.stack || '')
			else
				return object.message
		} else {
			return JSON.stringify(object)
		}
	}
	handleError(error) {
		this._createError(this._handleErrorLikeObject(error))
	}
	handleWarning(warning) {
		this._createWarning(this._handleErrorLikeObject(warning))
	}

}

