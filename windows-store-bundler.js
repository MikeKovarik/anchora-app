// warning: ugly fork from electron-windows-store. hopefuly I'll be able to PR some of it
// back into the module. This code currently does:
// 1) read info about the app from manifest & bump the version
// 2) bundle files into appx
// 3) create new or use existing certificates to sign it

var utils = require('electron-windows-store/lib/utils.js')
var {makeCert, signAppx} = require('electron-windows-store/lib/sign.js')
//var makeAppx = require('electron-windows-store/lib/makeappx.js')
var path = require('path')
var {promisify} = require('util')
var fsSync = require('fs')

var fs = {
	stat: promisify(fsSync.stat),
	unlink: promisify(fsSync.unlink),
	readFile: promisify(fsSync.readFile),
	writeFile: promisify(fsSync.writeFile),
}

bumpManifest()
	.then(() => loadManifest())
	.then(appInfo => createSettingsObjects(appInfo.packageName, appInfo.publisherName))
	.then(({program, makeCertOptions}) => {
		// Delete previous appx if it 
		//deleteAppx(program)
		//	.then(() => makeAppx(program))
		makeAppx(program)
			// Check existence of previously created certificates.
			.then(fs.stat(program.devCert))
			// No certificates exist yet, create new certs.
			.catch(() => makeCert(makeCertOptions))
			// Sign the appx
			.then(() => signAppx(program))
			//.then(() => bumpManifest())
	})


async function loadManifest(manifestPath = './AppxManifest.xml') {
	try {
		var manifestXml = (await fs.readFile(manifestPath)).toString()
	} catch(err) {
		throw new Error(`Couldn't find or load AppxManifest.xml file at ${manifestPath}`)
	}
	var identity = parseManifestIdentityTag(manifestXml)
	return {
		packageName: identity.name,
		publisherName: identity.publisher,
	}
}

async function bumpManifest(manifestPath = './AppxManifest.xml', type = 'revision') {
	var manifestXml = (await fs.readFile(manifestPath)).toString()
	// beware: naive implementation
	var {version} = parseManifestIdentityTag(manifestXml)
	var [major, minor, build, revision] = version.split('.').map(string => parseInt(string))
	switch (type) {
		case 'major':
			major++
			minor = build = revision = 0
			break
		case 'minor':
			minor++
			build = revision = 0
			break
		case 'build':
			build++
			revision = 0
			break
		case 'revision':
		default:
			revision++
	}
	var newVersion = [major, minor, build, revision].join('.')
	var newManifest = manifestXml.replace(`="${version}"`, `="${newVersion}"`)
	return fs.writeFile(manifestPath, newManifest)
}

function parseManifestIdentityTag(manifestXml) {
	var match = manifestXml.match(/<Identity.*?\/>/g)
	if (match === null)
		return {}
	var tag = match[0]
	var parsedObj = {}
	tag.slice(9, -2)
		.trim()
		.split(' ')
		.forEach(pairString => {
			var [key, val] = pairString.trim().slice(0, -1).split('="')
			parsedObj[key.toLowerCase()] = val
		})
	return parsedObj
}

function createSettingsObjects(packageName, publisherName, packageFilesPath = __dirname) {
	var program = {
		packageName,
		publisherName,
		sourceDirectory: packageFilesPath, // this is new
		outputDirectory: path.join(packageFilesPath, '/build'), // this is only here because of .appxFile
		assets: path.join(packageFilesPath, '/Assets'),
		windowsKit: utils.getDefaultWindowsKitLocation(),
	}
	// custom thing, would be nice to push as PR
	program.appxFile = path.join(program.outputDirectory, `${program.packageName}.appx`)

	var publisher = publisherName.split('=')[1]
	var certFilePath = path.join(process.env.APPDATA, 'electron-windows-store', publisher)
	// This object is what actually happens to the variables in inside setup.js & sign.js
	var makeCertOptions = {
		certFilePath,
		certFileName: publisher,
		publisherName: publisher,
		program,
	}
	// This happens internally in makeCert() but Ï'm not alway calling it
	program.devCert = path.join(makeCertOptions.certFilePath, `${makeCertOptions.certFileName}.pfx`)

	return {program, makeCertOptions}
}

// Forked and modified directly from electron-windows-store. Had to modify 'source' and 'destination/appxFile'.
// I already created issue about it but might also spend some time to put together a PR.
async function makeAppx(program) {
	if (!program.windowsKit)
		throw new Error('Path to Windows Kit not specified')

	console.log('Creating appx package...')

	let makeappx = path.join(program.windowsKit, 'makeappx.exe')
	let source = program.sourceDirectory
	let appxFile = path.join(program.outputDirectory, `${program.packageName}.appx`)
	let params = ['pack', '/d', source, '/p', appxFile, '/o'].concat(program.makeappxParams || [])

	if (program.assets) {
		let assetPath = path.normalize(program.assets)
		if (utils.hasVariableResources(assetPath)) {
			utils.debug(`Determined that package has variable resources, calling makeappx.exe with /l`)
			params.push('/l')
		}
	}

	return utils.executeChildProcess(makeappx, params)
}
/*
function deleteAppx(program) {
	return fs.unlink(program.appxFile).catch(err => {})
}
*/