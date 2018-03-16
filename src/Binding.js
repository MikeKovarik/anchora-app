import {observable, computedFrom, BindingEngine} from 'aurelia-framework'
import {AnchoraServer} from 'anchora'
import {Container} from 'aurelia-dependency-injection'



function retrieveFromLocalStorage(storageName) {
	var value = localStorage[storageName]
	if (value !== undefined) {
		if (value === 'true') return true
		if (value === 'false') return false
		if (parseFloat(value) == value) return parseFloat(value)
		return value
	}
}

export function localStored(proto, name, descriptor) {
	var {enumerable, initializer} = descriptor
	var className = proto.constructor.name
	var hiddenName = '_' + name
	var storageName = `${className}.${name}`
	var value = retrieveFromLocalStorage(storageName)
	if (value === undefined)
		value = initializer()
	console.log(name, value)
	descriptor.writable = false
	var dependencies = [hiddenName]
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
	initGetter.dependencies = dependencies
	get.dependencies = dependencies
	return {enumerable, get: initGetter, initSetter}
}

function isPrimitive(value) {
	return value === String
		|| value === Boolean
		|| value === Number
}

export class LocalStorageBinding {
	
	constructor(scope, ...args) {
		//console.log('LocalStorageBinding')
		this.scope = scope
		for (var arg of args) {
			if (Array.isArray(arg)) {
				this.props = arg
			} else {
				this.props = this.getBindableProperties()
				this.target = arg
			}
		}
		this.bindingEngine = Container.instance.get(BindingEngine)
		this.setupBinding()
	}

	getBindableProperties() {
		var bindable = Object.keys(this.scope)
		var proto = this.scope.constructor.prototype
		var protoDesc = Object.getOwnPropertyDescriptors(proto)
		for (var [name, descriptor] of Object.entries(protoDesc)) {
			if (name.startsWith('_')) continue
			if (descriptor.get && !descriptor.set) continue
			if (typeof descriptor.value === 'function') continue
			if (typeof proto[name] === 'function' && !isPrimitive(proto[name])) continue
			if (bindable.includes(name)) continue
			bindable.push(name)
		}
		return bindable.filter(name => name !== 'bindingEngine' && name !== 'anchora')
	}

	setupBinding() {
		var {scope, target, bindingEngine} = this
		this.props.forEach(name => {
			var storageName = `${scope.constructor.name}.${name}`
			var type = String
			if (scope[name] === Number || scope[name] === Boolean) {
				type = scope[name]
				scope[name] = undefined
			} 
			if (typeof scope[name] === 'number')  type = Number
			if (typeof scope[name] === 'boolean') type = Boolean
			if (target) {
				if (typeof target[name] === 'number')  type = Number
				if (typeof target[name] === 'boolean') type = Boolean
			}
			let stored = localStorage[storageName]
			if (stored) {
				if (type === Boolean) stored = stored === 'true'
				if (type === Number)  stored = parseInt(stored)
				scope[name] = stored
			}
			if (target) {
				if (scope[name] === undefined)
					scope[name] = target[name]
				else
					target[name] = scope[name]
			}
			bindingEngine
				.propertyObserver(scope, name)
				.subscribe(newValue => {
					localStorage[storageName] = newValue
					if (target)
					target[name] = newValue
				})
		})
	}

}

export function LocalStorageProxy(target, changeCallbacks = {}) {
	var className = target.constructor.name
	window.proxytarget = target
	var proxy = new Proxy(target, {
		get(target, name) {
			if (name === '__observers__')
				return target[name]
			var value = retrieveFromLocalStorage(`${className}.${name}`)
			if (value === undefined)
				value = target[name]
			if (typeof value === 'function')
				return value.bind(target)
			return value
		},
		set(target, name, newValue) {
			console.log('set', target, name, newValue)
			var oldValue = target[name]
			target[name] = newValue
			localStorage[`${className}.${name}`] = newValue
			if (changeCallbacks[name])
				changeCallbacks[name].call(proxy, newValue, oldValue)
			return true
		}
	})
	return proxy
}

// NOTE: AnchoraBinding does not directly inherit AnchoraServer anymore due to
//       problems caused by difference between Node JS context and Chromium context.
//       Aurelia's binding engine couldn't catch some events and listen to changes
//       causing the UI out of sync and not representative of actual settings running
//       in Node context of anchora's server instance.

export class AnchoraBinding {

	on() {} // TODO deleteme

	constructor(bindingEngine) {
		this.bindingEngine = bindingEngine
		this.anchora = {portUnsecure: 80, portSecure: 443} // TODO deleteme
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

	http = Boolean
	portSecure = Number
	portUnsecure = Number
	cgi = Boolean
	cors = Boolean

	@observable
	https = Boolean
	httpsChanged(newValue) {
		if (newValue)
			this.http2 = false
	}

	@observable
	http2 = Boolean
	http2Changed(newValue) {
		if (newValue)
			this.https = false
	}

	@observable
	portUnsecure
	portUnsecureChanged(newValue) {
		//console.log('portUnsecure changed. TODO: restart server')
	}

	@observable
	portSecure
	portSecureChanged(newValue) {
		//console.log('portSecure changed. TODO: restart server')
	}

}