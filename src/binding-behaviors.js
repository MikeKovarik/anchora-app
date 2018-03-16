export class IntBindingBehavior {

	bind(binding) {
		binding.standardUpdateSource = binding.updateSource
		binding.updateSource = function(value) {
			const intValue = parseInt(value, 10)
			if (isNaN(intValue)) {
				return
			}
			this.standardUpdateSource(intValue)
			if (intValue.toString(10) !== value) {
				this.updateTarget(intValue.toString(10))
			}
		}
	}

	unbind(binding) {
		binding.standardSource = binding.standardUpdateSource
		binding.originalUpdateSource = null
	}

}
