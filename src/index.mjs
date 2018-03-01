import {EventEmitter} from 'events'
import {server} from './server.mjs'
import {Binding} from './binding.mjs'


/*
var $log = document.querySelector('#log')

var _log = console.log.bind(console)
console.log = function(...args) {
	_log(...args)
	$log.innerHTML += args.map(data => JSON.stringify(data, null, 4)).join(', ') + '\n'
}
*/

process.on('unhandledRejection', reason => {
	console.log('unhandledRejection', reason)
})
process.on('uncaughtException', reason => {
	console.log('uncaughtException', reason)
})

class FileServApp extends EventEmitter {

	constructor() {
		super()
		this.server = server

		this.updateStatusUi = this.updateStatusUi.bind(this)
		this.start = this.start.bind(this)
		this._start = this._start.bind(this)
		this.stop = this.stop.bind(this)
		this._stop = this._stop.bind(this)
		this.restart = this.restart.bind(this)

		this.server.on('listening', () => this.status = 'running')
		this.server.on('error', () => this.status = 'error')
		this.server.on('close', () => {
			if (this.status !== 'restarting')
				this.status = 'stopped'
		})
		this.server.on('error', err => console.error('SERVER ERR', err))

		this.$port = document.querySelector('#port')
		this.$root = document.querySelector('#root')
		this.$start = document.querySelector('#start')
		this.$stop = document.querySelector('#stop')
		this.$status = document.querySelector('#status')
		this.$autostart = document.querySelector('#autostart')

		// Launched with argument to host specific folder
		if (process.argv.length > 1)
			this.root = process.argv[1]

		// Bind this.port to port input element and try to pull settings from localstorage.
		this.bindInput('port', parseInt, Number.isSafeInteger, 80)
		this.bindInput('root', a => a, a => true, 'C\\htdocs')
		this.bindCheckbox('autostart', true)

		this.$start.addEventListener('click', this.start)
		this.$stop.addEventListener('click', this.stop)

		this.updateStatusUi()

		if (this.autostart)
			this.start()
	}

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

	updateStatusUi() {
		var status = this.status
		var color
		if (status === 'running')
			color = 'green'
		else if (status === 'stopped' || status === 'error')
			color = 'red'
		else
			color = 'orange'
		this.$status.setAttribute('foreground', color)
		this.$status.textContent = status
		if (status === 'running') {
			this.$status.animate({opacity: [0,1]}, 100)
		}
		if (this.running) {
			this.$start.hidden = true
			this.$stop.hidden = false
		} else {
			this.$start.hidden = false
			this.$stop.hidden = true
		}
		if (color === 'orange') {
			this.$start.disabled = true
			this.$stop.disabled = true
		} else {
			this.$start.disabled = false
			this.$stop.disabled = false
		}
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
		this.server.listen(this.port)
	}

	stop() {
		this.status = 'stopping'
		this._stop()
	}
	_stop() {
		this.server.close()
	}


	bindInput(name, parser, validator, defaultVal) {
		var node = this['$' + name]
		var binding = new Binding({scope: this, name, node, parser, defaultVal})
		node.value = binding.get()
		node.addEventListener('change', e => {
			var value = parser(node.value)
			if (validator(value)) {
				node.removeAttribute('invalid')
				binding.set(value)
				this.restart()
			} else {
				node.setAttribute('invalid', '')
			}
		})
		//node.addEventListener('blur', e => {
		//	node.value = this[name]
		//})
	}

	bindCheckbox(name, defaultVal) {
		var node = this['$' + name]
		var binding = new Binding({scope: this, name, node, defaultVal})
		//node.checked = binding.get()
		//node.addEventListener('change', e => binding.set(node.checked))
	}

}


window.app = new FileServApp