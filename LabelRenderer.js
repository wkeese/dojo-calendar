define([
	"delite/register",
	"./_RendererMixin",
	"delite/handlebars!./templates/LabelRenderer.html"
], function (register, _RendererMixin, template) {

	return register("d-calendar-label", [HTMLElement, _RendererMixin], {
		// summary:
		//		The default item label renderer.

		template: template,

		_orientation: "horizontal",

		resizeEnabled: false,

		visibilityLimits: {
			resizeStartHandle: 50,
			resizeEndHandle: -1,
			summaryLabel: 15,
			startTimeLabel: 45,
			endTimeLabel: 30
		},

		_isElementVisible: register.superCall(function (sup) {
			return function (elt, startHidden, endHidden, size) {
				switch (elt) {
					case "startTimeLabel":
						// hide hour part of all day events on subsequent days
						if (this.item.allDay && this.item.range[0].getTime() !== this.item.startTime.getTime()) {
							return false;
						}
						break;
				}
				return sup.apply(this, arguments);
			};
		}),

		_displayValue: "inline"
	});
});
