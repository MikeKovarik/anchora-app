const winBlurBg = require('./build/Release/winblurbg')


function uint32ToBuffer(uint32) {
	var buffer = Buffer.alloc(4)
	buffer.writeUInt32BE(uint32)
	return buffer
}

function bufferToUint32(buffer) {
	return buffer.readUInt32BE()
}

function getElectronHwmdBuffer() {
	return require('electron')
		.remote
		.getCurrentWindow()
		.getNativeWindowHandle()
		.slice(0, 4)
		.reverse()
}

function getElectronHwmdUint32() {
	var buffer = getElectronHwmdBuffer()
	return bufferToUint32(buffer)
}

function getCurrentWindow() {
	var uint = winBlurBg.getWindowHandle()
	var buffer = uint32ToBuffer(uint)
	console.log('HWMD', uint, buffer, winBlurBg.bufferToUint(buffer.reverse()))
}

setTimeout(() => console.log('setBlurBg()', winBlurBg.setBlurBg()), 1500)
//setTimeout(() => getCurrentWindow