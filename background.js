var nw = require('nw.gui')
var gui = nw

var appWindow
var appVisible = false

class AppWindow {

	constructor() {
		this.visible = false
		this.minimized = false
		this.toggle = this.toggle.bind(this)
		this.show = this.show.bind(this)
		this.hide = this.hide.bind(this)
		this.close = this.close.bind(this)

		gui.Window.open('./index.html', {
			title: 'Anchora',
			position: 'center',
			width: 800,
			height: 550,
		    //resizable: true,
		    //toolbar: false,
		    frame: false,
		    //show: true
		}, nwWindow => {
			this.visible = true
			this.nwWindow = nwWindow
			this.window = nwWindow.window
			this.document = nwWindow.window.document
			this.nwWindow.on('close', this.close)
			this.nwWindow.on('minimize', () => this.minimized = true)
			this.nwWindow.on('restore', () => this.minimized = false)
		})
	}

	toggle() {
		if (!this.visible || this.minimized)
			this.show()
		else
			this.hide()
	}

	show() {
		if (this.minimized)
			this.nwWindow.restore()
		if (this.visible) return
		this.nwWindow.setShowInTaskbar(true)
		setTimeout(() => this.nwWindow.show())
		this.visible = true
	}

	hide() {
		if (!this.visible) return
		this.nwWindow.minimize()
		this.nwWindow.setShowInTaskbar(false)
		this.visible = false
	}

	close() {
		if (this.running)
			this.hide()
		else
			this.nwWindow.close(true)
	}

}

var win = new AppWindow()

// Reference to window and tray
var tray = new nw.Tray({
	icon: 'img/tray-48.png',
	title: 'Anchora HTTP Server',
})
tray.on('click', win.toggle)

tray.menu = new nw.Menu()

var openItem = new nw.MenuItem({
	label: 'Settings',
})
openItem.on('click', win.show)

var toggleItem = new nw.MenuItem({
	label: 'Start Server'
})
toggleItem.on('click', () => {
	console.log('toggle click')
	toggleItem.label = 'Start Server' + Math.random()
})

var quitItem = new nw.MenuItem({
	label: 'Quit Anchora',
})
quitItem.on('click', () => console.log('quitItem click'))
quitItem.on('click', () => nw.App.quit())

tray.menu.append(openItem)
tray.menu.append(new nw.MenuItem({type: 'separator'}))
tray.menu.append(toggleItem)
tray.menu.append(new nw.MenuItem({type: 'separator'}))
tray.menu.append(quitItem)