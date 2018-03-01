import selfsigned from 'selfsigned'
import cp from 'child_process'
import pathModule from 'path'
import util from 'util'
import {fs} from './util.mjs'
var {promisify} = util
selfsigned.generate = promisify(selfsigned.generate)



export async function loadOrGenerateCertificate(options) {
	try {
		var certs = await loadCertificate(options)
	} catch(err) {
		console.log(err)
		var certs = await generateCertificate()
		try {
			await storeCertificate(options, certs)
			await installCertificate(options)
		} catch(err) {
			throw new Error(`certificates could not be loaded nor created, '${options.key}' '${options.cert}'`)
			console.log(err)
		}
	}
	options.key = certs.key
	options.cert = certs.cert
	return options
}

export async function generateCertificate() {
	var attrs = [{name: 'commonName', value: 'localhost'}]
	var result = await selfsigned.generate(attrs, {days: 365})
	var key = result.private
	var cert = result.cert
	return {key, cert}
}

export async function loadCertificate(options) {
	var [key, cert] = await Promise.all([
		fs.readFile(options.keyPath),
		fs.readFile(options.certPath)
	])
	return {key, cert}
}

export function storeCertificate(options, certs) {
	return Promise.all([
		fs.writeFile(options.keyPath,  certs.key),
		fs.writeFile(options.certPath, certs.cert)
	])
}

export function installCertificate(options) {
	return exec(`certutil -addstore -user -f root "${options.certPath}"`)
}

function exec(command) {
	return new Promise((resolve, reject) => {
		cp.exec(command, (error, stdout, stderr) => {
			if (error || stderr)
				reject(error || stderr)
			else
				resolve(stdout)
		})
	})
}
