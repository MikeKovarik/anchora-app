import {observable, computedFrom} from 'aurelia-framework'
import {AnchoraServer} from 'anchora'


export class AnchoraBinding extends AnchoraServer {

	constructor() {
		console.log('AnchoraBinding 1')
		super()
		console.log('AnchoraBinding 2')
		console.log('this.cacheControl', this.cacheControl)
		//this.setup()
	}

	@observable
	cacheControl = 'FOO'
	cacheControlChanged(newValue) {
		console.log('cacheControlChanged', newValue)
	}


	@computedFrom('http')
	get unsecure() {
		console.log('get unsecure')
		return this.http
	}

	@computedFrom('https', 'http2')
	get secure() {
		console.log('get secure')
		return this.https || this.http2
	}

	@observable
	root = localStorage.root || 'C:\\htdocs'
	rootChanged(newValue) {
		console.log('rootChanged', newValue)
		localStorage.root = newValue
	}

	@observable
	unsecurePort = parseInt(localStorage.unsecurePort) || 80
	unsecurePortChanged(newValue) {
		console.log('unsecurePortChanged', newValue)
		localStorage.unsecurePort = newValue
	}

	@observable
	securePort = parseInt(localStorage.securePort) || 443
	securePortChanged(newValue) {
		console.log('securePortChanged', newValue)
		localStorage.securePort = newValue
	}

	@observable
	forceUpgrade

	@observable
	allowUpgrade

	@observable
	http = localStorage.http === 'true'
	httpChanged(newValue) {
		this.unsecure = localStorage.http = newValue
	}

	@observable
	https = localStorage.https === 'true'
	httpsChanged(newValue) {
		console.log('httpsChanged', newValue)
		localStorage.https = newValue
		if (newValue)
			this.http2 = false
	}

	@observable
	http2 = localStorage.http2 === 'true'
	http2Changed(newValue) {
		console.log('http2Changed', newValue)
		localStorage.http2 = newValue
		if (newValue)
			this.https = false
	}


}