
export class Binding {

	constructor(options) {
		var {scope, name, node, parser, defaultVal} = options

		if (node && !parser) {
			switch (node.type) {
				case 'checkbox':
					parser = parseBoolean
					break
				case 'number':
					parser = parseInt
					break
			}
		}

		this.name = name
		this.parser = parser
		this.scope = scope
		this.node = node

		if (isNotValue(scope[name]) && parser)
			scope[name] = parser(localStorage[name])
		if (isNotValue(scope[name]))
			scope[name] = defaultVal

		if (node) {
			this.type = node.type
			node.checked = this.get()
			node.addEventListener('change', e => this.onChange())
		}

	}

	onChange() {
		if (this.type === 'checkbox')
			var value = this.node.checked
		else
			var value = this.node.value
		if (this.parser)
			value = this.parser(value)
		this.set(value)
	}

	get() {
		var {name, scope} = this
		return scope[name]
	}

	set(newValue) {
		console.log('set', newValue)
		var {name, scope} = this
		scope[name] = localStorage[name] = newValue
	}

}

function isNotValue(value) {
	return value === undefined
		|| value === null
		|| Number.isNaN(value)
}

function parseBoolean(value) {
	if (value === 'true'  || value === true)  return true
	if (value === 'false' || value === false) return false
}