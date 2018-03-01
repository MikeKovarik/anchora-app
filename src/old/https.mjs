import https from 'https'
import pathModule from 'path'
import {MIME, getMime} from './util.mjs'
import {loadOrGenerateCertificate} from './cert.mjs'
import {root} from './options.mjs'


loadOrGenerateCertificate()
	.then(launchHttpsServer)
	.catch(console.error)


function launchHttpsServer({key, cert}) {
	var options = {key, cert}
	var server = https.createServer(options, onRequest)
	server.on('request', (req, res) => console.log('REQ', req.url))
	server.on('listening', () => console.log('listening'))
	server.listen(443)
}

function onRequest(req, res) {
	console.log('REQ', req.url)
	res.writeHead(200)
	res.end("hello world\n")
}
