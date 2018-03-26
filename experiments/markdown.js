var path = require('path')
var http = require('http')
var fs = require('fs')
var {promisify} = require('util')
var readFile = promisify(fs.readFile)
var marked = require('marked')


var server = http.createServer(async (req, res) => {
	var fsPath = path.join('C:\\Users\\Mike\\OneDrive\\Dev', req.url)
	try {
		var ext = path.extname(req.url).toLowerCase().slice(1)
		console.log('ext', ext)
		res.writeHead(200)
		if (ext === 'md' || ext === 'markdown') {
			var markdown = (await readFile(fsPath)).toString()
			var githubCss = (await readFile('./node_modules/github-markdown-css/github-markdown.css')).toString()
			var markdownHtml = marked(markdown)
			var html = `
			<!DOCTYPE html>
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<style>
					${githubCss}
					.markdown-body {
						box-sizing: border-box;
						max-width: 980px;
						margin: 0 auto;
						padding: 45px;
					}
					@media (max-width: 767px) {
						.markdown-body {
							padding: 15px;
						}
					}
				</style>
			</head>
			<body class="markdown-body">
				${markdownHtml}
			</body>
			</html>
			`
			res.write(html)
		} else {
			res.write(await readFile(fsPath))
		}
	} catch(err) {
		console.log(err)
		res.writeHead(500)
	}
	res.end()
})


server.listen(80)