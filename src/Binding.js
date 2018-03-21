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
	var hiddenName = '_' + name
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
	return {enumerable, get: initGetter, initSetter}
}


export function LocalStorageProxy(target) {
	var className = target.constructor.name

	var proxy = new Proxy(target, {

		get(target, name) {
			if (name === '__observers__')
				return target[name]
			if (typeof target[name] === 'function')
				return target[name].bind(target)
			return retrieveValue(`${className}.${name}`, target[name])
		},

		set(target, name, newValue) {
			target[name] = newValue
			localStorage[`${className}.${name}`] = newValue
			return true
		}

	})

	return proxy
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