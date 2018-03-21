// Transforms string template bound value back into integer in model
export class IntBindingBehavior {

	bind(binding) {
		binding._updateSource = binding.updateSource
		binding.updateSource = function(value) {
			const intValue = parseInt(value, 10)
			if (isNaN(intValue)) return
			this._updateSource(intValue)
			var stringValue = intValue.toString(10)
			if (stringValue !== value)
				this.updateTarget(stringValue)
		}
	}

	unbind(binding) {
		binding.updateSource = binding._updateSource
	}

}

// model boolean <-> binding string
export class BoolBindingBehavior {

	bind(binding) {
		binding._updateSource = binding.updateSource
		binding._updateTarget = binding.updateTarget
		// from string template binding into boolean model value
		binding.updateSource = value => binding._updateSource(value === 'true')
		// from boolean model value into string template binding
		binding.updateTarget = value => binding._updateTarget(value + '')
	}

	unbind(binding) {
		binding.updateSource = binding._updateSource
		binding.updateTarget = binding._updateTarget
	}

}
