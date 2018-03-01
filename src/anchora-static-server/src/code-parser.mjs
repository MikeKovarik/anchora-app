import path from 'path'
import {fs} from './util.mjs'
import {getDescriptor} from './files.mjs'
//import {parse} from 'resource-url-extract'
import {parse} from '../../../../resource-url-extract/index.mjs'


export {parse}
/*
//var filePath = 'C:/Users/Mike/OneDrive/Dev/image processor/index.html'
var filePath = 'C:/Users/kenrm/OneDrive/Dev/fileServ/index.html'

getDescriptor(undefined, filePath)
	.then(async desc => {
		var data = await fs.readFile(filePath).then(String)
		//var parsed = parse(data, desc.dir)
		var parsed = parse(data, 'html')
		console.log(desc.dir)
		console.log(parsed)
	})


function getFullPath(reqPath, dir, root) {
	if (reqPath.startsWith('/') || reqPath.startsWith('\\'))
		return path.join(root, reqPath)
	else
		return path.join(dir, reqPath)
}*/