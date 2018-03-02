SystemJS.config({
	map: {
		"fs": "@node/fs",
		"url": "@node/url",
		"path": "@node/path",
		"util": "@node/util",
		"http": "@node/http",
		"https": "@node/https",
		"http2": "@node/http2",
		"buffer": "@node/buffer",
		"events": "@node/events",
		"stream": "@node/stream",
		"zlib": "@node/zlib",
		"child_process": "@node/child_process",
	},
})

if (typeof global !== 'undefined') {
	// Trying to get node_modules to load through systemjs (which was built for browsers)
	// can cause serious trauma, madness and life crysis.
	// Be like Mike. Don't give a fuck and just short circuit it. it works...
	// Technically. This isn't even a hack.
	System.set('anchora', System.newModule(global.require('anchora')))
	System.set('nw.gui', System.newModule(global.require('nw.gui')))
} else {
	// For when it's easier to quickly view the app from browser for UI tweaks.
	var noop = () => {}
	System.set('anchora', System.newModule({
		createServer: () => {
			return {
				listen: noop,
				close: noop,
				on: noop,
				emit: noop,
			}
		},
		changeDebugger: noop,
		resetDebugger: noop,
	}))
}

SystemJS.import('aurelia-bootstrapper').catch(console.error)
