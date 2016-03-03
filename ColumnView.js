define([
	"delite/register",
	"dojo/_base/event",
	"dojo/_base/lang",
	"dojo/_base/sniff",
	"dojo/_base/fx",
	"dojo/dom",
	"dojo/dom-class",
	"dojo/dom-style",
	"dojo/dom-geometry",
	"dojo/dom-construct",
	"dojo/on",
	"dojo/date",
	"dojo/date/locale",
	"dojo/query",
	"./SimpleColumnView",
	"delite/handlebars!./templates/ColumnView.html",
	"./ColumnViewSecondarySheet"
], function (
	register,
	event,
	lang,
	has,
	fx,
	dom,
	domClass,
	domStyle,
	domGeometry,
	domConstruct,
	on,
	date,
	locale,
	query,
	SimpleColumnView,
	template,
	ColumnViewSecondarySheet
) {

	return register("d-calendar-column-view", [SimpleColumnView], {

		// summary:
		//		This class defines a simple column view that also uses a secondary
		//		sheet to display long or all day events.
		//		By default an dojox.calendar.ColumnViewSecondarySheet instance is created.
		//		Set the secondarySheetClass property to define the class to instantiate,
		//		for example to mix the default class with Mouse, Keyboard or Touch plugins.

		template: template,

		baseClass: "dojoxCalendarColumnView",

		// secondarySheetClass: Class
		//		The secondary sheet class, by default dojox.calendar.ColumnViewSecondarySheet.
		secondarySheetClass: ColumnViewSecondarySheet,

		// secondarySheetProps: Object
		//		Secondary sheet constructor parameters.
		secondarySheetProps: null,

		// headerPadding: Integer
		//		Padding between the header (composed of the secondary sheet and the column header)
		//		and the primary sheet.
		headerPadding: 3,

		_showSecondarySheet: true,

		// List of properties to forward to secondary sheet.
		forwardProperties: [
			"store", "query", "queryOptions", "startTimeAttr", "endTimeAttr", "summaryAttr", "allDayAttr",
			"subColumnAttr", "decodeDate", "encodeDate", "itemToRenderItem", "renderItemToItem",
			"datePackage",
			"endDate", "date", "minDate", "maxDate", "dateInterval", "dateIntervalSteps",
			"firstDayOfWeek",
			"formatItemTimeFunc",
			"editable", "moveEnabled", "resizeEnabled",
			"createOnGridClick", "createItemFunc",
			"textDir", "decorationStore",
			"getIdentity"
		],

		render: register.superCall(function (sup) {
			return function () {
				sup.apply(this, arguments);
				if (this.secondarySheetPlaceholder) {
					var args = {owner: this};
					this.forwardProperties.forEach(function (prop) {
						if (this[prop] !== null && this[prop] !== undefined) {
							var value = typeof prop === "function" ? this[prop].bind(this) : this[prop];
							args[prop] = value;
						}
					}, this);
					lang.mixin(args, this.secondarySheetProps);
					this.secondarySheet = new this.secondarySheetClass(args);
					this.secondarySheet.placeAt(this.secondarySheetPlaceholder, "replace");
				}
			};
		}),

		destroy: function () {
			if (this.secondarySheet) {
				this.secondarySheet.destroy();
			}
		},

		_setVisibility: register.superCall(function (sup) {
			return function (value) {
				sup.apply(this, arguments);
				if (this.secondarySheet) {
					this.secondarySheet._setVisibility(value);
				}
			};
		}),

		resize: register.superCall(function (sup) {
			return function () {
				sup.apply(this, arguments);
				if (this.secondarySheet) {
					// secondary sheet is sized by CSS
					this.secondarySheet.resize();
				}
			};
		}),

		refreshRendering: function (props) {
			if ("subColumns" in props && this.secondarySheet) {
				var h = domGeometry.getMarginBox(this.secondarySheet).h;
				this.resizeSecondarySheet(h);
			}
			if (this.secondarySheet) {
				// Forward property changes to second sheet
				this.forwardProperties.forEach(function (prop) {
					if (prop in props && this[prop] !== null && this[prop] !== undefined) {
						var value = typeof prop === "function" ? this[prop].bind(this) : this[prop];
						this.secondarySheet[prop] = value;
					}
				}, this);
				this.secondarySheet.deliver();
			}
		},

		resizeSecondarySheet: function (height) {
			// summary:
			//		Resizes the secondary sheet header and relayout the other sub components
			//		according this new height.
			//		Warning: this method is only available for the default template and default CSS.
			// height: Integer
			//		The new height in pixels.

			if (this.secondarySheet) {
				var headerH = domGeometry.getMarginBox(this.header).h;
				domStyle.set(this.secondarySheet, "height", height + "px");
				this.secondarySheet._resizeHandler(null, true);
				var top = (height + headerH + this.headerPadding);
				if (this.subHeader && this.subColumns) {
					domStyle.set(this.subHeader, "top", top + "px");
					top += domGeometry.getMarginBox(this.subHeader).h;
				}
				domStyle.set(this.scrollContainer, "top", top + "px");
				if (this.vScrollBar) {
					domStyle.set(this.vScrollBar, "top", top + "px");
				}
			}
		},

		updateRenderers: register.superCall(function (sup) {
			return function (obj, stateOnly) {
				sup.apply(this, arguments);
				if (this.secondarySheet) {
					this.secondarySheet.updateRenderers(obj, stateOnly);
				}
			};
		}),

		_defaultItemToRendererKindFunc: function (item) {
			return item.allDay ? null : "vertical"; // String
		},

		// TODO: combine to use pointer events?
		_onGridTouchStart: register.after(function () {
			this._doEndItemEditing(this.secondarySheet, "touch");
		}),

		_onGridMouseDown: register.after(function () {
			this._doEndItemEditing(this.secondarySheet, "mouse");
		}),

		_configureScrollBar: register.superCall(function (sup) {
			return function () {
				sup.apply(this, arguments);
				if (this.secondarySheet) {
					var atRight = (this.effectiveDir === "ltr" || this.scrollBarRTLPosition == "right");
					domStyle.set(this.secondarySheet, atRight ? "right" : "left", this.scrollbarWidth + "px");
					domStyle.set(this.secondarySheet, atRight ? "left" : "right", "0");

					this.secondarySheet._hScrollNodes.forEach(function (elt) {
						domClass[this.hScrollBarEnabled ? "add" : "remove"](elt.parentNode,
							"dojoxCalendarHorizontalScroll");
					}, this);
				}
			};
		}),

		_configureHScrollDomNodes: register.superCall(function (sup) {
			return function (styleWidth) {
				sup.apply(this, arguments);
				if (this.secondarySheet && this.secondarySheet._configureHScrollDomNodes) {
					this.secondarySheet._configureHScrollDomNodes(styleWidth);
				}
			};
		}),

		_setHScrollPosition: register.superCall(function (sup) {
			return function (pos) {
				sup.apply(this, arguments);
				if (this.secondarySheet) {
					this.secondarySheet._setHScrollPosition(pos);
				}
			};
		})
	});
});
