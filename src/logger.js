export var logs = []

function getTime() {
	var date = new Date()
	return date.getHours().toString().padStart(2, '0')
	+ ':' + date.getMinutes().toString().padStart(2, '0')
	+ ':' + date.getSeconds().toString().padStart(2, '0')
}

export function log(...args) {
	var string = getTime() + ' - ' + args.map(arg => arg.toString())
	logs.unshift(string)
}

// Handle all errors
console._error = console.error.bind(console)
console.error = (...args) => {
	log(...args)
	console._error(...args)
}
console._log = console.log.bind(console)
console.log = (...args) => {
	log(...args)
	console._log(...args)
}
/*
var $log = document.querySelector('#log')

var _log = console.log.bind(console)
console.log = function(...args) {
	_log(...args)
	$log.innerHTML += args.map(data => JSON.stringify(data, null, 4)).join(', ') + '\n'
}
*/

// Handle Node errors
if (typeof process !== 'undefined') {
	process.on('unhandledRejection', reason => {
		console.error('unhandledRejection', reason)
	})
	process.on('uncaughtException', reason => {
		console.error('uncaughtException', reason)
	})
}

window.addEventListener('unhandledrejection', event => {
    // Prevent error output on the console:
    event.preventDefault();
    console.warn('unhandledrejection' + event.reason)
    console.error(event.reason.message)
    console._error(event.reason)
})
