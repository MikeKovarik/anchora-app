//Configure Bluebird Promises.
/*
Promise.config({
	warnings: {
		wForgottenReturn: false
	}
})
*/
export function configure(aurelia) {
	aurelia.use
		.standardConfiguration()
		.developmentLogging()

	aurelia.start().then(() => aurelia.setRoot())
}
