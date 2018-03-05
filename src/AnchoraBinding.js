import {observable, computedFrom, inject, BindingEngine} from 'aurelia-framework'
import {AnchoraServer} from 'anchora'


// NOTE: AnchoraBinding does not directly inherit AnchoraServer anymore due to
//       problems caused by difference between Node JS context and Chromium context.
//       Aurelia's binding engine couldn't catch some events and listen to changes
//       causing the UI out of sync and not representative of actual settings running
//       in Node context of anchora's server instance.

@inject(BindingEngine)
export class AnchoraBinding {

	on() {} // TODO deleteme

	constructor(bindingEngine) {
		this.bindingEngine = bindingEngine
		this.server = {unsecurePort: 80, securePort: 443} // TODO deleteme
	}

	getBindableProperties() {
		var bindable = Object.keys(this)
		var proto = this.constructor.prototype
		var protoDesc = Object.getOwnPropertyDescriptors(proto)
		for (var [name, descriptor] of Object.entries(protoDesc)) {
			if (name.startsWith('_')) continue
			if (descriptor.get && !descriptor.set) continue
			if (typeof descriptor.value === 'function') continue
			if (typeof proto[name] === 'function') continue
			if (bindable.includes(name)) continue
			bindable.push(name)
		}
		bindable = bindable.filter(name => name !== 'bindingEngine' && name !== 'server')
		return bindable
	}

	setupBinding() {
		var {server, bindingEngine} = this
		this.getBindableProperties()
			.forEach(name => {
				//console.log('###', name, this[name])
				if (this[name] !== undefined)
					server[name] = this[name]
				else {
					let stored = localStorage[name]
					if (stored) {
						switch (this[`_${name}Type`]) {
							case Boolean:
								stored = stored === 'true'
								break
							case Number:
								stored = parseInt(stored)
								break
						}
					}
					this[name] = stored || server[name]
				}
				bindingEngine
					.propertyObserver(this, name)
					.subscribe(newValue => {
						//console.log('changing', name, newValue)
						localStorage[name] = newValue
						server[name] = newValue
					})
			})
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

	_httpType = Boolean
	_httpsType = Boolean
	_http2Type = Boolean
	_securePortType = Number
	_unsecurePortType = Number

	@observable
	https
	httpsChanged(newValue) {
		if (newValue)
			this.http2 = false
	}

	@observable
	http2
	http2Changed(newValue) {
		if (newValue)
			this.https = false
	}

	@observable
	unsecurePort
	unsecurePortChanged(newValue) {
		console.log('unsecurePort changed. TODO: restart server')
	}

	@observable
	securePort
	securePortChanged(newValue) {
		console.log('securePort changed. TODO: restart server')
	}

}