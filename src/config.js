export function configure(aurelia) {
	aurelia.use
		.standardConfiguration()
		.developmentLogging()
		.globalResources('./custom-attributes')
		.globalResources('./binding-behaviors')

	aurelia.start().then(() => aurelia.setRoot())
}