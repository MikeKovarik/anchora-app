import {BindingEngine} from 'aurelia-framework'
import {Container} from 'aurelia-dependency-injection'


var bindingEngine = Container.instance.get(BindingEngine)

function retrieveValue(storageName, defaultValue) {
	var value = localStorage[storageName]
	if (value !== undefined) {
		if (defaultValue === Boolean)
			return value === 'true'
		else if (defaultValue === Number)
			return parseFloat(value)
		if (value === 'true') return true
		if (value === 'false') return false
		if (parseFloat(value) == value) return parseFloat(value)
		return value
	}
	return defaultValue
}


// decorator compatible with aurelia's binding system
export function localStored(proto, name, descriptor) {
	var {enumerable, initializer} = descriptor
	var className = proto.constructor.name
	var hiddenName = `_${name}`
	var storageName = `${className}.${name}`
	var defaultValue = initializer && initializer()
	var value = retrieveValue(storageName, defaultValue)

	function rewriteDescriptor(instance) {
		Object.defineProperty(instance, name, {enumerable, get, set})
	}

	function initGetter() {
		this[hiddenName] = value
		rewriteDescriptor(this)
		return this[hiddenName]
	}

	function initSetter(newValue) {
		this[hiddenName] = newValue
		rewriteDescriptor(this)
	}

	function get() {
		return this[hiddenName]
	}

	function set(newValue) {
		this[hiddenName] = newValue
		localStorage[storageName] = newValue
	}

	initGetter.dependencies = get.dependencies = [hiddenName]
	return {enumerable, get: initGetter, set: initSetter}
}



export class LocalStorageBinding {

	setupBinding() {
		var target = this.target
		var className = this.constructor.name
		var proto = target.constructor.prototype

		var propertyNames = Object.keys(target)
		var methodNames = []

		var protoDesc = Object.getOwnPropertyDescriptors(proto)
		for (let [name, descriptor] of Object.entries(protoDesc)) {
			if (descriptor.get) {
				Object.defineProperty(this, name, {
					get() {
						return target[name]
					},
					set(newValue) {target[name] = newValue},
				})
			} else {
				methodNames.push(name)
			}
		}

		for (let name of methodNames) {
			if (name !== 'constructor')
				this[name] = (...args) => target[name](...args)
		}

		for (let storageName of Object.keys(localStorage)) {
			if (!storageName.startsWith(`${className}.`))
				continue
			let name = storageName.split('.')[1]
			if (!propertyNames.includes(name))
				propertyNames.push(name)
		}
		
		for (let name of propertyNames) {
			let type = typeof target[name]
			if (type === 'function' || type === 'object')
				continue
			let defaultValue = this[name]
			if (defaultValue === undefined)
				defaultValue = target[name]
			let storageName = `${className}.${name}`
			let currentValue = retrieveValue(storageName, defaultValue)
			// Propagate custom settings back into anchora module.
			target[name] = this[name] = currentValue
			// Start listening for changes on this property and apply new value into anchora server.
			bindingEngine
				.propertyObserver(this, name)
				.subscribe(newValue => {
					localStorage[storageName] = newValue
					target[name] = newValue
				})
		}
	}

}




var originalAttached = Symbol()
var originalDetached = Symbol()
var observeRequests = Symbol()
var killbacks = Symbol()

export function observe(...paths) {
	return (proto, callbackName, descriptor) => {
		if (proto.attached !== customAttached) {
			proto[originalAttached] = proto.attached
			proto.attached = customAttached
		}
		if (proto.detached !== customDetached) {
			proto[originalDetached] = proto.detached
			proto.detached = customDetached
		}
		proto[observeRequests] = proto[observeRequests] || []
		for (var path of paths)
			proto[observeRequests].push({path, callbackName})
	}
}

function customAttached() {
	this[killbacks] = this[observeRequests].map(({path, callbackName}) => {
		var steps = path.split('.')
		var propName = steps.pop()
		var target = this
		while (steps.length) {
			target = target[steps.shift()]
			if (target === undefined || target === null)
				return
		}
		return bindingEngine
			.propertyObserver(target, propName)
			.subscribe(this[callbackName].bind(this))
			.dispose
	})
	.filter(dispose => dispose)
	this[originalAttached]()
}

function customDetached() {
	this[killbacks]
		.forEach(dispose => dispose())
	this[originalDetached]()
}
