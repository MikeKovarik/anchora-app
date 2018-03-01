var fs = require('fs')

fs.readFile('C:/Windows/System32/drivers/etc/hosts', (err, buffer) => {
	console.log(buffer.toString())
})

exec('ipconfig /flushdns')