// warning: ugly fork from electron-windows-store. hopefuly I'll be able to PR some of it
// back into the module. This code currently does:
// 1) read info about the app from manifest & bump the version
// 2) bundle files into appx
// 3) create new or use existing certificates to sign it

var utils = require('electron-windows-store/lib/utils.js')
var {makeCert, signAppx} = require('electron-windows-store/lib/sign.js')
//var makeAppx = require('electron-windows-store/lib/makeappx.js')
var path = require('path')
var cp = require('child_process')
var chalk = require('chalk')
var {promisify} = require('util')
var fsSync = require('fs')

var fs = {
	stat: promisify(fsSync.stat),
	unlink: promisify(fsSync.unlink),
	readFile: promisify(fsSync.readFile),
	writeFile: promisify(fsSync.writeFile),
	readdir: promisify(fsSync.readdir),
}


incrementalBuild()
//buildFromPackage('./AppxManifest.xml', './package.json')


async function incrementalBuild(program) {
	if (program === undefined) {
		let identity = await buildFromManifestOrPackage()
		program = createProgramObject(identity.name, identity.publisher)
	}

	console.log(program)
	var makeCertOptions = createMakeCertOptions(program)

	// Delete folder with previously built appx because we don't want it to be included
	// in the new appx bundle since its inside the folder that's about to be bundled.
	fs.unlink(program.appxFile)
		// Swallow the error that arises if there's not appx to delete.
		.catch(err => {})
		// Create new appx bundle from the __dirpath folder
		.then(() => makeAppx(program))
		// Check existence of previously created certificates.
		.then(() => fs.stat(program.devCert))
		// No certificates exist yet, create new certs.
		.catch(() => makeCert(makeCertOptions))
		// Sign the appx
		.then(() => signAppx(program))
		//.then(() => bumpVersion())
		.then(() => launchAppx(program))
}

async function buildFromManifestOrPackage() {
	var manifestPath = './AppxManifest.xml'
	var packagePath = './package.json'
	// Check existence of AppxManifest.xml and use it for building, otherwise generate it from package.json.
	await fs.stat(manifestPath)
		.catch(createManifestFromPackage(manifestPath, packagePath))

	// TODO: move this to separate function that bumps version in both package
	// and manifest simultaneously. Also make this optional?
	await bumpVersions(manifestPath, packagePath)

	try {
		var manifestXml = (await fs.readFile(manifestPath)).toString()
	} catch(err) {
		throw new Error(`Couldn't find or load AppxManifest.xml file at ${manifestPath}`)
	}
	return parseManifestIdentityTag(manifestXml)
}

async function buildFromPackage(manifestPath, packagePath) {
	// experimental
	createManifestFromPackage(manifestPath, packagePath)
}

async function createManifestFromPackage(manifestPath, packagePath) {
	// TODO: create manifest file from info from package.json
	// WARNING: this is not actual code, just a pseudo code. An idea of what it could look like
	var xml = {}
	var package = require(packagePath)

	xml.name = package.name
	xml.id = xml.name
	xml.version = package.version + '.0'
	xml.description = package.description
	xml.publisher = 'CN=' + '???'
	xml.displayName = '???'
	xml.publisherDisplayName = '???'
	xml.executable = '???'
	//xml.maxVersionTested = os.release()

	var assetsPath = './Assets' // this will be retrieved from `program` object
	var assetScales = new Set
	var assetNames = new Set
	assetFiles = await fs.readdir(assetsPath)
	assetFiles
		.filter(fileName => fileName.endsWith('.png'))
		.forEach(fileName => {
			// Trim .png
			fileName = fileName.slice(0, -4)
			if (fileName.includes('.scale-')) {
				let index = fileName.indexOf('.scale-')
				let name = fileName.slice(0, index)
				let scale = fileName.slice(index + 7)
				assetNames.add(name)
				assetScales.add(scale)
			} else {
				if (fileName.includes('.targetsize'))
					fileName = fileName.slice(0, fileName.indexOf('.targetsize'))
				assetNames.add(fileName)
			}
		})

	xml.uapScales = Array.from(assetScales)

	if (assetNames.has('StoreLogo'))
		xml.logo = path.join(assetsPath, 'StoreLogo.png')

	var remainingAssets = Array.from(assetNames).filter(name => !name.includes('StoreLogo'))
	createAssetAttribute = name => `${name}="${path.join(assetsPath, name)}"`

	xml.visualElementsAttributes = remainingAssets
		.filter(name => name.includes('150x150') || name.includes('44x44'))
		.map(createAssetAttribute)
		.join(' ')

	xml.defaultTilesAttributes = remainingAssets
		.filter(name => !name.includes('150x150') && !name.includes('44x44'))
		.map(createAssetAttribute)
		.join(' ')

	xml.showNameOnTiles = undefined // TODO

	// TODO: render the data from xml object into template of the AppxManifest
}


async function bumpVersions(manifestPath, packagePath) {
	// TODO: change this completely. Try to read both files, find highest version
	// and use that as a base for incrementing. then write it back to both files.

	// NOTE: It's desireable to bump 'revisision' (the 4th number) in windows styled versions
	// while development and not touch package.json version at all during development.
	// And then bump either 'build'/'bugfix' (the 3rd number) or 'minor' for release.

	try {
		var manifestXml = (await fs.readFile(manifestPath)).toString()
		var manifestVersion = parseManifestIdentityTag(manifestXml).version
	} catch(err) {
		throw new Error(`Couldn't find or load AppxManifest.xml file at ${manifestPath}`)
	}
	console.log('manifestVersion', manifestVersion)

	var newVersion = bumpVersionString(manifestVersion, 'revision')
	console.log('newVersion', newVersion)
	var newManifest = manifestXml.replace(`="${manifestVersion}"`, `="${newVersion}"`)
	return fs.writeFile(manifestPath, newManifest)
}

function bumpVersionString(version, type = 'revision') {
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
	return [major, minor, build, revision]
		// Filter out revision which is undefined in case of package.json's semver versioning style.
		.filter(v => v !== undefined)
		// Put it back toghether into a string form.
		.join('.')
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

function createProgramObject(packageName, publisherName, packageFilesPath = __dirname) {
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
	return program
}

function createMakeCertOptions(program) {
	var publisher = program.publisherName.split('=')[1]
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
	return makeCertOptions
}

// Forked and modified directly from electron-windows-store. Had to modify 'source' and 'destination/appxFile'.
// I already created issue about it but might also spend some time to put together a PR.
async function makeAppx(program) {
	if (!program.windowsKit)
		throw new Error('Path to Windows Kit not specified')

	utils.log(chalk.bold.green('Creating appx package...'))

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

function launchAppx(program) {
	cp.exec(program.appxFile)
}