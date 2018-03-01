import {launchHybridServer} from './index.mjs'

var root = `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`

var options = {
	root,
	cors: false,
	gzip: false,
	type: 'http2',
}

launchHybridServer(options)
	.catch(console.error)
