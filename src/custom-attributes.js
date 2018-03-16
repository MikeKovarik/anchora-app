import {inject} from 'aurelia-framework'


@inject(Element)
export class ForegroundCustomAttribute {

	constructor(element) {
		this.element = element
	}

	bind() {
		this.element.setAttribute('foreground', this.value)
	}

}