define([
	"dcl/dcl",
	"luxon",
	"delite/register",
	"dojo/_base/lang",
	"requirejs-dplugins/has",
	"dojo/_base/fx",
	"dojo/_base/html",
	"delite/on",
	"dojo/dom",
	"dojo/dom-class",
	"dojo/dom-style",
	"dojo/dom-geometry",
	"dojo/dom-construct",
	"./ViewBase",
	"delite/handlebars!./templates/MatrixView.html",
	"requirejs-dplugins/css!./css/MatrixView.css"
], function (
	dcl,
	luxon,
	register,
	lang,
	has,
	fx,
	html,
	on,
	dom,
	domClass,
	domStyle,
	domGeometry,
	domConstruct,
	ViewBase,
	template
) {
	var DateTime = luxon.DateTime;

	/*=====
	 var __HeaderClickEventArgs = {
		 // summary:
		 //		A column click event.
		 // index: Integer
		 //		The column index.
		 // date: DateTime
		 //		The date displayed by the column.
		 // triggerEvent: Event
		 //		The origin event.
	 };
	 =====*/

	/*=====
	 var __ExpandRendererClickEventArgs = {
		 // summary:
		 //		A expand renderer click event.
		 // columnIndex: Integer
		 //		The column index of the cell.
		 // rowIndex: Integer
		 //		The row index of the cell.
		 // date: DateTime
		 //		The date displayed by the cell.
		 // triggerEvent: Event
		 //		The origin event.
	 };
	 =====*/

	return register("d-calendar-matrix", [HTMLElement, ViewBase], {
		// summary:
		//		The matrix view is a calendar view that displaying a matrix where each cell is a day.

		template: template,

		baseClass: "d-calendar-matrix-view",

		// viewKind: String
		//		Type of the view. Used by the calendar widget to determine how to configure the view.
		//		This view kind is "matrix".
		viewKind: "matrix",

		// startDate: DateTime
		//		The start date of the time interval displayed.
		//		If not set at initialization time, will be set to current day.
		startDate: null,

		// refStartTime: DateTime?
		//		(Optional) Start of the time interval of interest.
		//		It is used to style differently the displayed rows out of the
		//		time interval of interest.
		refStartTime: null,

		// refStartTime: DateTime?
		//		(Optional) End of the time interval of interest.
		//		It is used to style differently the displayed rows out of the
		//		time interval of interest.
		refEndTime: null,

		// columnCount: Integer
		//		The number of column to display (from the startDate).
		columnCount: 7,

		// rowCount: Integer
		//		The number of rows to display (from the startDate).
		rowCount: 5,

		// horizontalRenderer: Class
		//		The class use to create horizontal renderers.
		horizontalRenderer: dcl.prop({
			set: function (value) {
				this._destroyRenderersByKind("horizontal");		// clear cache
				this._set("horizontalRenderer", value);
			},
			get: function () {
				return this._get("horizontaRenderer");
			}
		}),

		// labelRenderer: Class
		//		The class use to create label renderers.
		labelRenderer: dcl.prop({
			set: function (value) {
				this._destroyRenderersByKind("label");		// clear cache
				this._set("labelRenderer", value);
			},
			get: function () {
				return this._get("labelRenderer");
			}
		}),

		// expandRenderer: Class
		//		The class use to create drill down renderers.
		expandRenderer: dcl.prop({
			set: function (value) {
				// if() statement to avoid failure from dcl (or delite?) problem where this is
				// called while creating a subclass of MatrixView.
				if (this._ddRendererList && this._ddRendererPool) {
					while (this._ddRendererList.length > 0) {
						this._destroyExpandRenderer(this._ddRendererList.pop());
					}

					var pool = this._ddRendererPool;
					if (pool) {
						while (pool.length > 0) {
							this._destroyExpandRenderer(pool.pop());
						}
					}
				}

				this._set("expandRenderer", value);
			},
			get: function () {
				return this._get("expandRenderer");
			}
		}),

		// horizontalDecorationRenderer: Class
		//		The class use to create horizontal decoration renderers.
		horizontalDecorationRenderer: null,

		// percentOverlap: Integer
		//		The percentage of the renderer width used to superimpose one item renderers on another
		//		when two events are overlapping. By default 0.
		percentOverlap: 0,

		// verticalGap: Integer
		//		The number of pixels between two item renderers that are overlapping each other
		//		if the percentOverlap property is 0.
		verticalGap: 2,

		// horizontalRendererHeight: Integer
		//		The height in pixels of the horizontal renderers that is applied by the layout.
		horizontalRendererHeight: 17,

		// labelRendererHeight: Integer
		//		The height in pixels of the label renderers that is applied by the layout.
		labelRendererHeight: 14,

		// expandRendererHeight: Integer
		//		The height in pixels of the expand/collapse renderers that is applied by the layout.
		expandRendererHeight: 15,

		// cellPaddingTop: Integer
		//		The top offset in pixels of each cell applied by the layout.
		cellPaddingTop: 16,

		// expandDuration: Integer
		//		Duration of the animation when expanding or collapsing a row.
		expandDuration: 300,

		// expandEasing: Function
		//		Easing function of the animation when expanding or collapsing a row (null by default).
		expandEasing: null,

		// layoutDuringResize: Boolean
		//		Indicates if the item renderers' position and size is updated or if they are hidden
		//		during a resize of the widget.
		layoutDuringResize: false,

		// roundToDay: Boolean
		//		For horizontal renderers that are not filling entire days, whether fill the day or not.
		roundToDay: true,

		// showCellLabel: Boolean
		//		Whether display or not the grid cells label (usually the day of month).
		showCellLabel: true,

		// scrollable: [private] Boolean
		scrollable: false,

		// resizeCursor: [private] Boolean
		resizeCursor: "e-resize",

		constructor: function () {
			// Setup cache for ExpandRenderers.
			// TODO: leverage code in RendererManager.js.
			// Apparently need to cache item renderers separately from expand renderers though,
			// so that we can release all the item renderers w/out releasing expand renderers (or vice-versa).
			this._ddRendererList = [];
			this._ddRendererPool = [];
		},

		computeProperties: function (oldVals) {
			if (this.startDate == null) {
				this.startDate = DateTime.local().startOf("day");
			}

			if (this.columnCount < 1 || isNaN(this.columnCount)) {
				this.columnCount = 1;
			}

			if (this.rowCount < 1 || isNaN(this.rowCount)) {
				this.rowCount = 1;
			}

			if (isNaN(this.percentOverlap) || this.percentOverlap < 0 || this.percentOverlap > 100) {
				this.percentOverlap = 0;
			}

			if (isNaN(this.verticalGap) || this.verticalGap < 0) {
				this.verticalGap = 2;
			}

			if (isNaN(this.horizontalRendererHeight) || this.horizontalRendererHeight < 1) {
				this.horizontalRendererHeight = 17;
			}

			if (isNaN(this.labelRendererHeight) || this.labelRendererHeight < 1) {
				this.labelRendererHeight = 14;
			}

			if (isNaN(this.expandRendererHeight) || this.expandRendererHeight < 1) {
				this.expandRendererHeight = 15;
			}

			if ("startDate" in oldVals || "columnCount" in oldVals || "rowCount" in oldVals || "source" in oldVals) {
				this.dates = [];
				var d = this.startDate.startOf("day");
				for (var row = 0; row < this.rowCount; row++) {
					this.dates.push([]);
					for (var col = 0; col < this.columnCount; col++) {
						this.dates[row].push(d);
						d = d.plus({ day: 1 });
					}
				}

				this.startTime = this.dates[0][0];
				this.endTime = this.dates[this.rowCount - 1][this.columnCount - 1];
				this.endTime = this.endTime.plus({ day: 1 }).startOf("day");

				if (this.source) {
					this.query = new this.source.Filter().lte("startTime", this.endTime).gte("endTime", this.startTime);
				}
			}
		},

		__fixEvt: function (e) {
			e.sheet = "primary";
			e.source = this;
			return e;
		},

		//////////////////////////////////////////
		//
		// Formatting functions
		//
		//////////////////////////////////////////

		_formatRowHeaderLabel: function (/*DateTime*/ d) {
			// summary:
			//		Computes the row header label for the specified time of day.
			//		The rowHeaderDatePattern property can be used to set a
			//		custom date pattern to the formatter.
			// d: DateTime
			//		The date to format
			// tags:
			//		protected

			if (this.rowHeaderDatePattern) {
				return d.toFormat(this.rowHeaderDatePattern);
			} else {
				return d.weekNumber;
			}
		},

		_formatColumnHeaderLabel: function (d) {
			// summary:
			//		Computes the column header label for the specified date.
			// d: DateTime
			//		The date to format
			// tags:
			//		protected

			return d.weekdayLong;
		},

		// cellHeaderShortPattern: String
		//		Custom date/time pattern for grid cell label to override default one coming from the CLDR.
		//		See https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens.
		cellHeaderShortPattern: null,

		// cellHeaderLongPattern: String
		//		Custom date/time pattern for grid cell label to override default one coming from the CLDR.
		//		The long pattern is used for the first day of month or the first displayed day of a month.
		//		See https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens.
		cellHeaderLongPattern: null,

		_formatGridCellLabel: function (d, row, col) {
			// summary:
			//		Computes the column header label for the specified date.
			//		By default a formatter is used, optionally the <code>cellHeaderLongPattern</code> and
			//		<code>cellHeaderShortPattern</code>
			//		properties can be used to set a custom date pattern to the formatter.
			// d: DateTime
			//		The date to format.
			// row: Integer
			//		The row that displays the current date.
			// col: Integer
			//		The column that displays the current date.
			// tags:
			//		protected

			var isFirstDayOfMonth = row === 0 && col === 0 || d.day === 1;
			if (isFirstDayOfMonth) {
				if (this.cellHeaderLongPattern) {
					return d.toFormat(this.cellHeaderLongPattern);
				} else {
					return d.toLocaleString({ month: "short", day: "2-digit" });
				}
			} else {
				if (this.cellHeaderShortPattern) {
					return d.toFormat(this.cellHeaderShortPattern);
				} else {
					return d.toLocaleString({ day: "2-digit" });
				}
			}
		},

		////////////////////////////////////////////
		//
		// HTML structure management
		//
		///////////////////////////////////////////

		_createRendering: function () {
			// summary:
			//		Create or update the HTML structure (grid, place holders, headers, etc)
			// tags:
			//		private

			this.sheetHeight = this.itemContainer.offsetHeight;
			this._computeRowsHeight();

			// TODO: only call these methods when necessary
			this._buildColumnHeader();
			this._buildRowHeader();
			this._buildGrid();
			this._buildItemContainer();
		},

		_buildColumnHeader: function () {
			// summary:
			//		Creates incrementally the HTML structure of the column header and configures its content.
			// tags:
			//		private

			var table = this.columnHeaderTable;
			if (!table) {
				return;
			}
			var tr = table.rows[0] || table.insertRow();

			// Adjust number of cells to equal this.columnCount.
			var i, actualColumns = tr.children.length;
			for (i = actualColumns; i < this.columnCount; i++) {
				tr.insertCell();	// create additional cells (if needed)
			}
			for (i = actualColumns; i > this.columnCount; i--) {
				tr.removeChild(tr.lastChild);		// remove excess cells (if necessary)
			}

			// fill & configure
			Array.prototype.forEach.call(tr.children, function (td, i) {
				td.className = "";
				var d = this.dates[0][i];
				this._setText(td, this._formatColumnHeaderLabel(d));
				this.styleColumnHeaderCell(td, d, this);
			}, this);

			if (this.yearColumnHeaderContent) {
				var d = this.dates[0][0];
				this._setText(this.yearColumnHeaderContent, d.toLocaleString({ year: "numeric" }));
			}
		},

		styleColumnHeaderCell: function (node, date) {
			// summary:
			//		Styles the CSS classes to the node that displays a column header cell.
			//		By default this method is setting the "d-calendar-weekend"
			//		if the day of week represents a weekend.
			// node: Node
			//		The DOM node that displays the column in the grid.
			// date: DateTime
			//		The date displayed by this column
			// tags:
			//		protected

			domClass.add(node, this._cssDays[date.weekday - 1]);

			if (this.isWeekEnd(date)) {
				domClass.add(node, "d-calendar-weekend");
			}
		},

		_rowHeaderClick: function (e) {
			var index = e.currentTarget.index;
			this.emit("row-header-click", {
				index: index,
				date: this.dates[index][0],
				triggerEvent: e
			});
		},

		_buildRowHeader: function () {
			// summary:
			//		Creates incrementally the HTML structure of the row header and configures its content.
			// tags:
			//		private

			var table = this.rowHeaderTable;
			if (!table) {
				return;
			}

			// Adjust number of rows to equal this.rowCount.
			var i;
			for (i = table.rows.length; i < this.rowCount; i++) {
				var td = table.insertRow().insertCell();
				on(td, "click", this._rowHeaderClick.bind(this));
			}
			for (i = table.rows.length; i > this.rowCount; i--) {
				table.deleteRow(-1);
			}

			// fill labels
			Array.prototype.forEach.call(table.rows, function (tr, i) {
				domStyle.set(tr, "height", this._getRowHeight(i) + "px");

				var td = tr.firstChild;
				td.className = "";
				td.index = i;

				var d = this.dates[i][0];
				this.styleRowHeaderCell(td, d);
				this._setText(td, this._formatRowHeaderLabel(d));
			}, this);
		},

		styleRowHeaderCell: function (/*===== node, date =====*/) {
			// summary:
			//		Styles the CSS classes to the node that displays a row header cell.
			//		By default this method is doing nothing.
			// node: Node
			//		The DOM node that displays the column in the grid.
			// date: DateTime
			//		The date in the week.
			// tags:
			//		protected
		},

		_buildGrid: function () {
			// summary:
			//		Creates incrementally the HTML structure of the grid and configures its content.
			// tags:
			//		private

			var table = this.gridTable;
			if (!table) {
				return;
			}

			// Adjust number of rows to equal this.rowCount.
			var i;
			for (i = table.rows.length; i < this.rowCount; i++) {
				table.insertRow();
			}
			for (i = table.rows.length; i > this.rowCount; i--) {
				table.deleteRow(-1);
			}

			// Set the CSS classes
			Array.prototype.forEach.call(table.rows, function (tr, row) {
				// Adjust number of cells to equal this.columnCount.
				for (i = tr.children.length; i < this.columnCount; i++) {
					var td = tr.insertCell();
					domConstruct.create("span", null, td);
				}
				for (i = tr.children.length; i > this.columnCount; i--) {
					tr.removeChild(tr.lastChild);
				}

				domStyle.set(tr, "height", this._getRowHeight(row) + "px");
				tr.className = "";

				Array.prototype.forEach.call(tr.children, function (td, col) {
					td.className = "";

					var d = this.dates[row][col];
					var span = td.firstChild;
					this._setText(span, this.showCellLabel ? this._formatGridCellLabel(d, row, col) : null);

					this.styleGridCell(td, d);
				}, this);
			}, this);
		},

		styleGridCell: function (node, date) {
			// summary:
			//		Styles the CSS classes to the node that displays a cell.
			//		By default this method is setting the following CSS classes:
			//		- "d-calendar-today" class name if the date displayed is the current date,
			//		- "d-calendar-weekend" if the date represents a weekend or
			//		- "d-calendar-day-disabled" if the date is out of the [refStartTime, refEndTime] interval.
			//		- the CSS class corresponding of the displayed day of week ("Sun", "Mon" and so on).
			// node: Node
			//		The DOM node that displays the cell in the grid.
			// date: DateTime
			//		The date displayed by this cell.
			// tags:
			//		protected

			domClass.add(node, this._cssDays[date.weekday - 1]);

			if (this.isToday(date)) {
				domClass.add(node, "d-calendar-today");
			} else if (this.refStartTime != null && this.refEndTime != null &&
				(date >= this.refEndTime || date.plus({ day: 1 }) <= this.refStartTime)) {
				domClass.add(node, "d-calendar-day-disabled");
			} else if (this.isWeekEnd(date)) {
				domClass.add(node, "d-calendar-weekend");
			}
		},

		_buildItemContainer: function () {
			// summary:
			//		Creates the HTML structure of the item container and configures its content.
			// tags:
			//		private

			var table = this.itemContainerTable;
			if (!table) {
				return;
			}

			// Adjust number of rows to equal this.rowCount.
			var i;
			for (i = table.rows.length; i < this.rowCount; i++) {
				var tr = table.insertRow();
				tr.className = "d-calendar-item-container-row";
				var td = tr.insertCell();
				var div = domConstruct.create("div", null, td);
				div.className = "d-calendar-container-row";
			}
			for (i = table.rows.length; i > this.rowCount; i--) {
				table.deleteRow(-1);
			}

			this.cells = Array.prototype.map.call(table.rows, function (tr, i) {
				domStyle.set(tr, "height", this._getRowHeight(i) + "px");
				return tr.childNodes[0].childNodes[0];
			}, this);
		},

		resize: dcl.superCall(function (sup) {
			return function () {
				sup.apply(this, arguments);
				this._resizeHandler(null, false);
			};
		}),

		_resizeHandler: function (e, apply) {
			// summary:
			//		Refreshes and apply the row height according to the widget height.
			// e: Event
			//		The resize event (optional)
			// apply: Boolean
			//		Whether take into account the layoutDuringResize flag to relayout item while resizing or not.
			// tags:
			//		private

			if (this.sheetHeight != this.itemContainer.offsetHeight) {
				// refresh values
				this.sheetHeight = this.itemContainer.offsetHeight;
				var expRow = this.getExpandedRowIndex();
				if (expRow == -1) {
					this._computeRowsHeight();
					this._resizeRows();
				} else {
					this.expandRow(this.expandedRow, this.expandedRowCol, 0, null, true);
				}
			}

			if (this.layoutDuringResize || apply) {
				// Use a time for FF (at least). In FF the cell size and position info are not ready yet.
				this.defer(function () {
					this._layoutRenderers();
					this._layoutDecorationRenderers();
				}, 20);
			} else {
				domStyle.set(this.itemContainer, "opacity", 0);
				this._recycleItemRenderers();
				this._recycleExpandRenderers();
				if (this._resizeTimer !== undefined) {
					clearTimeout(this._resizeTimer);
				}
				this._resizeTimer = this.defer(function () {
					delete this._resizeTimer;
					this._resizeRowsImpl(this.itemContainer);
					this._layoutRenderers();
					this._layoutDecorationRenderers();
					if (this.resizeAnimationDuration === 0) {
						domStyle.set(this.itemContainer, "opacity", 1);
					} else {
						fx.fadeIn({node: this.itemContainer, curve: [0, 1]}).play(this.resizeAnimationDuration);
					}
				}, 200);
			}
		},

		// resizeAnimationDuration: Integer
		//		Duration, in milliseconds, of the fade animation showing the item renderers after a widget resize.
		resizeAnimationDuration: 0,

		/////////////////////////////////////////////
		//
		// Row height management
		//
		//////////////////////////////////////////////

		getExpandedRowIndex: function () {
			// summary:
			//		Returns the index of the expanded row or -1 if there's no row expanded.
			return this.expandedRow == null ? -1 : this.expandedRow;
		},

		collapseRow: function (duration, easing, apply) {
			// summary:
			//		Collapses the expanded row, if any.
			// duration: Integer
			//		Duration in milliseconds of the optional animation.
			// easing: Function
			//		Easing function of the optional animation.

			if (apply === undefined) {
				apply = true;
			}
			if (duration === undefined) {
				duration = this.expandDuration;
			}

			if (this.expandedRow != null && this.expandedRow != -1) {
				if (apply && duration) {
					var index = this.expandedRow;
					var oldSize = this.expandedRowHeight;
					delete this.expandedRow;
					this._computeRowsHeight();
					var size = this._getRowHeight(index);
					this.expandedRow = index;

					this._recycleExpandRenderers();
					this._recycleItemRenderers();
					domStyle.set(this.itemContainer, "display", "none");

					this._expandAnimation = new fx.Animation({
						curve: [oldSize, size],
						duration: duration,
						easing: easing,
						onAnimate: function (size) {
							this._expandRowImpl(Math.floor(size));
						}.bind(this),
						onEnd: function () {
							this._expandAnimation = null;
							this._collapseRowImpl(false);
							this._resizeRows();
							domStyle.set(this.itemContainer, "display", "block");
							this.defer(this._layoutRenderers, 100);
							this.emit("expand-animation-end");
						}.bind(this)
					});

					this._expandAnimation.play();
				} else {
					this._collapseRowImpl(apply);
				}
			}
		},

		_collapseRowImpl: function (apply) {
			// tags:
			//		private

			delete this.expandedRow;
			delete this.expandedRowHeight;
			this._computeRowsHeight();
			if (apply === undefined || apply) {
				this._resizeRows();
				this._layoutRenderers();
			}
		},

		expandRow: function (rowIndex, colIndex, duration, easing, apply) {
			// summary:
			//		Expands the specified row.
			// rowIndex: Integer
			//		The index of the row to expand.
			// colIndex: Integer?
			//		The column index of the expand renderer that triggers the action, optional.
			// duration: Integer?
			//		Duration in milliseconds of the optional animation.
			// easing: Function?
			//		Easing function of the optional animation.

			if (rowIndex < 0 || rowIndex >= this.rowCount) {
				return -1;
			}
			if (colIndex === undefined || colIndex < 0 || colIndex >= this.columnCount) {
				colIndex = -1; // ignore invalid values
			}
			if (apply === undefined) {
				apply = true;
			}
			if (duration === undefined) {
				duration = this.expandDuration;
			}
			if (easing === undefined) {
				easing = this.expandEasing;
			}

			var oldSize = this._getRowHeight(rowIndex);
			var size = this.sheetHeight - Math.ceil(this.cellPaddingTop * (this.rowCount - 1));

			this.expandedRow = rowIndex;
			this.expandedRowCol = colIndex;
			this.expandedRowHeight = size;

			if (apply) {
				if (duration) {
					//debugger;
					this._recycleExpandRenderers();
					this._recycleItemRenderers();
					domStyle.set(this.itemContainer, "display", "none");

					this._expandAnimation = new fx.Animation({
						curve: [oldSize, size],
						duration: duration,
						delay: 50,
						easing: easing,
						onAnimate: function (size) {
							this._expandRowImpl(Math.floor(size));
						}.bind(this),
						onEnd: function () {
							this._expandAnimation = null;
							domStyle.set(this.itemContainer, "display", "block");
							this.defer(function () {
								this._expandRowImpl(size, true);
							}, 100);
							this.emit("expand-animation-end");
						}.bind(this)
					});
					this._expandAnimation.play();
				} else {
					this._expandRowImpl(size, true);
				}
			}
		},

		_expandRowImpl: function (size, layout) {
			// tags:
			//		private

			this.expandedRowHeight = size;
			this._computeRowsHeight(this.sheetHeight - size);
			this._resizeRows();
			if (layout) {
				this._layoutRenderers();
			}
		},

		_resizeRows: function () {
			// summary:
			//		Refreshes the height of the underlying HTML objects.
			// tags:
			//		private

			if (this._getRowHeight(0) <= 0) {
				return;
			}

			if (this.rowHeaderTable) {
				this._resizeRowsImpl(this.rowHeaderTable);
			}
			if (this.gridTable) {
				this._resizeRowsImpl(this.gridTable);
			}
			if (this.itemContainerTable) {
				this._resizeRowsImpl(this.itemContainerTable);
			}
		},

		_computeRowsHeight: function (max) {
			// summary:
			//		1. Determine if it's better to add or remove pixels
			//		2. distribute added/removed pixels on first and last rows.
			//		if rows are not too small, it is not noticeable.
			// tags:
			//		private

			max = max || this.sheetHeight;

			max--;

			if (this.rowCount == 1) {
				this.rowHeight = max;
				this.rowHeightFirst = max;
				this.rowHeightLast = max;
				return;
			}

			var count = this.expandedRow == null ? this.rowCount : this.rowCount - 1;
			var rhx = max / count;
			var rhf, rhl, rh;

			var diffMin = max - (Math.floor(rhx) * count);
			var diffMax = Math.abs(max - (Math.ceil(rhx) * count));
			var diff;

			var sign = 1;
			if (diffMin < diffMax) {
				rh = Math.floor(rhx);
				diff = diffMin;
			} else {
				sign = -1;
				rh = Math.ceil(rhx);
				diff = diffMax;
			}
			rhf = rh + sign * Math.floor(diff / 2);
			rhl = rhf + sign * (diff % 2);

			this.rowHeight = rh;
			this.rowHeightFirst = rhf;
			this.rowHeightLast = rhl;
		},

		_getRowHeight: function (index) {
			// tags:
			//		private

			if (index == this.expandedRow) {
				return this.expandedRowHeight;
			} else if (this.expandedRow === 0 && index === 1 || index === 0) {
				return this.rowHeightFirst;
			} else if (this.expandedRow == this.rowCount - 1 &&
				index === this.rowCount - 2 ||
				index === this.rowCount - 1) {
				return this.rowHeightLast;
			} else {
				return this.rowHeight;
			}
		},

		_resizeRowsImpl: function (tableNode) {
			// tags:
			//		private
			Array.prototype.forEach.call(tableNode.rows, function (tr, i) {
				domStyle.set(tr, "height", this._getRowHeight(i) + "px");
			}, this);
		},

		////////////////////////////////////////////
		//
		// Item renderers
		//
		///////////////////////////////////////////

		_destroyExpandRenderer: function (renderer) {
			// summary:
			//		Destroys the expand renderer.
			// renderer: dcalendar/_RendererMixin
			//		The item renderer to destroy.
			// tags:
			//		protected

			if (renderer.destroy) {
				renderer.destroy();
			}
		},

		_getExpandRenderer: function (date, items, rowIndex, colIndex, expanded) {
			// tags:
			//		private

			if (this.expandRenderer == null) {
				return null;
			}

			var ir = this._ddRendererPool.pop();
			if (ir == null) {
				ir = new this.expandRenderer();
			}

			this._ddRendererList.push(ir);

			ir.owner = this;
			ir.date = date;
			ir.items = items;
			ir.rowIndex = rowIndex;
			ir.colIndex = colIndex;
			ir.expanded = expanded;

			return ir;
		},

		_recycleExpandRenderers: function (remove) {
			// tags:
			//		private

			for (var i = 0; i < this._ddRendererList.length; i++) {
				var ir = this._ddRendererList[i];
				ir.up = false;
				ir.down = false;
				if (remove) {
					ir.parentNode.removeChild(ir);
				}
				domStyle.set(ir, "display", "none");
			}
			this._ddRendererPool = this._ddRendererPool.concat(this._ddRendererList);
			this._ddRendererList = [];
		},

		_defaultItemToRendererKindFunc: function (item) {
			// tags:
			//		private
			var dur = Math.abs(item.endTime.diff(item.startTime, "minute").minutes);
			return dur >= 1440 ? "horizontal" : "label";
		},

		////////////////////////////////////////////
		//
		// Layout
		//
		///////////////////////////////////////////

		// naturalRowHeight: Integer[]
		//		After an item layout has been done, contains for each row the natural height of the row.
		//		Ie. the height, in pixels, needed to display all the item renderers.
		naturalRowsHeight: null,

		_roundItemToDay: function (item) {
			// tags:
			//		private

			var s = item.startTime, e = item.endTime;

			if (!this.isStartOfDay(s)) {
				s = s.startOf("day");
			}
			if (!this.isStartOfDay(e)) {
				e = e.plus({ day: 1}).startOf("day");
			}
			return {startTime: s, endTime: e};
		},

		_sortItemsFunction: function (a, b) {
			// tags:
			//		private

			if (this.roundToDay) {
				a = this._roundItemToDay(a);
				b = this._roundItemToDay(b);
			}

			return (+a.startTime - +b.startTime) || (+b.endTime - +a.endTime);
		},

		_overlapLayoutPass3: function (lanes) {
			// summary:
			//		Third pass of the overlap layout (optional). Compute the number of lanes used by sub interval.
			// lanes: Object[]
			//		The array of lanes.
			// tags:
			//		private

			var pos = 0, posEnd = 0;
			var res = [];

			var refPos = domGeometry.position(this.gridTable).x;

			for (var col = 0; col < this.columnCount; col++) {

				var stop = false;
				var colPos = domGeometry.position(this._getCellAt(0, col));
				pos = colPos.x - refPos;
				posEnd = pos + colPos.w;

				for (var lane = lanes.length - 1; lane >= 0 && !stop; lane--) {
					for (var i = 0; i < lanes[lane].length; i++) {
						var item = lanes[lane][i];
						stop = item.start < posEnd && pos < item.end;
						if (stop) {
							res[col] = lane + 1;
							break;
						}
					}
				}

				if (!stop) {
					res[col] = 0;
				}
			}

			return res;
		},

		applyRendererZIndex: function (item, renderer, hovered, selected, edited /*=====, focused =====*/) {
			// summary:
			//		Applies the z-index to the renderer based on the state of the item.
			//		This methods is setting a z-index of 20 is the item is selected or edited
			//		and the current lane value computed by the overlap layout (i.e. the renderers
			//		are stacked according to their lane).
			// item: Object
			//		The render item.
			// renderer: Object
			//		A renderer associated with the render item.
			// hovered: Boolean
			//		Whether the item is hovered or not.
			// selected: Boolean
			//		Whether the item is selected or not.
			// edited: Boolean
			//		Whether the item is being edited not not.
			// focused: Boolean
			//		Whether the item is focused not not.
			// tags:
			//		private

			domStyle.set(renderer.container, {"zIndex": edited || selected ? renderer.renderer.mobile ? 100 : 0 :
				item.lane === undefined ? 1 : item.lane + 1});
		},

		_layoutDecorationRenderers: dcl.superCall(function (sup) {
			return function () {
				// tags:
				//		private
				if (this.visibleDecorationItems == null || this.rowHeight <= 0) {
					return;
				}

				if (!this.gridTable || this._expandAnimation != null ||
					this.horizontalDecorationRenderer == null) {
					this.decorationRendererManager.recycleItemRenderers();
					return;
				}

				this._layoutStep = this.columnCount;
				this.gridTablePosX = domGeometry.position(this.gridTable).x;

				sup.apply(this, arguments);
			};
		}),

		_layoutRenderers: dcl.superCall(function (sup) {
			return function () {
				// tags:
				//		private
				if (this.visibleItems == null || this.rowHeight <= 0) {
					return;
				}

				if (!this.gridTable || this._expandAnimation != null ||
					(this.horizontalRenderer == null && this.labelRenderer == null)) {
					this._recycleItemRenderers();
					return;
				}

				this.gridTablePosX = domGeometry.position(this.gridTable).x;
				this._layoutStep = this.columnCount;
				this._recycleExpandRenderers();
				this._hiddenItems = [];
				this._offsets = [];
				this.naturalRowsHeight = [];

				sup.apply(this, arguments);
			};
		}),

		_offsets: null,

		_layoutInterval: function (/*Integer*/index, /*DateTime*/start, /*DateTime*/end,
								   /*Object[]*/items, /*String*/itemsType) {
			// tags:
			//		private

			if (this.cells == null) {
				return;
			}

			if (itemsType === "dataItems") {
				var horizontalItems = [];
				var labelItems = [];

				for (var i = 0; i < items.length; i++) {
					var item = items[i];
					var kind = this._itemToRendererKind(item);
					if (kind == "horizontal") {
						horizontalItems.push(item);
					} else if (kind == "label") {
						labelItems.push(item);
					}
				}

				var expIndex = this.getExpandedRowIndex();

				if (expIndex != -1 && expIndex != index) {
					return; // when row is expanded, layout only expanded row
				}

				var hiddenItems = [];

				var hItems = null;
				var hOffsets = [];
				if (horizontalItems.length > 0 && this.horizontalRenderer) {
					hItems = this._createHorizontalLayoutItems(index, start, end, horizontalItems, itemsType);
					var hOverlapLayout = this._computeHorizontalOverlapLayout(hItems, hOffsets);
				}

				var lItems;
				var lOffsets = [];
				if (labelItems.length > 0 && this.labelRenderer) {
					lItems = this._createLabelLayoutItems(index, start, end, labelItems);
					this._computeLabelOffsets(lItems, lOffsets);
				}

				var hasHiddenItems = this._computeColHasHiddenItems(index, hOffsets, lOffsets);

				if (hItems != null) {
					this._layoutHorizontalItemsImpl(index, hItems, hOverlapLayout, hasHiddenItems, hiddenItems,
						itemsType);
				}

				if (lItems != null) {
					this._layoutLabelItemsImpl(index, lItems, hasHiddenItems, hiddenItems, hOffsets, itemsType);
				}

				this._layoutExpandRenderers(index, hasHiddenItems, hiddenItems);

				this._hiddenItems[index] = hiddenItems;
			} else { // itemsType === "decorationItems"
				if (this.horizontalDecorationRenderer) {
					hItems = this._createHorizontalLayoutItems(index, start, end, items, itemsType);
					if (hItems != null) {
						this._layoutHorizontalItemsImpl(index, hItems, null, false, null, itemsType);
					}
				}
			}
		},

		_createHorizontalLayoutItems: function (/*Integer*/index, /*DateTime*/startTime, /*DateTime*/endTime,
												/*Object[]*/items, /*String*/itemsType) {
			// tags:
			//		private

			var sign = this.effectiveDir === "rtl" ? -1 : 1;
			var layoutItems = [];
			var isDecoration = itemsType === "decorationItems";

			// step 1: compute projected position and size
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				var overlap = this.computeRangeOverlap(item.startTime, item.endTime, startTime, endTime);

				var startOffset = Math.round(overlap[0].startOf("day").diff(startTime, "day").days);
				var dayStart = this.dates[index][startOffset];

				var celPos = domGeometry.position(this._getCellAt(index, startOffset, false));
				var start = celPos.x - this.gridTablePosX;
				if (this.effectiveDir === "rtl") {
					start += celPos.w;
				}

				if (isDecoration && !item.isAllDay || !isDecoration && !this.roundToDay && !item.allDay) {
					start += sign * this.computeProjectionOnDate(dayStart, overlap[0], celPos.w);
				}

				start = Math.ceil(start);

				var endOffset = Math.round(overlap[1].startOf("day").diff(startTime, "day").days);

				var end;
				if (endOffset > this.columnCount - 1) {
					celPos = domGeometry.position(this._getCellAt(index, this.columnCount - 1, false));
					if (this.effectiveDir === "rtl") {
						end = celPos.x - this.gridTablePosX;
					} else {
						end = celPos.x - this.gridTablePosX + celPos.w;
					}
				} else {
					dayStart = this.dates[index][endOffset];
					celPos = domGeometry.position(this._getCellAt(index, endOffset, false));
					end = celPos.x - this.gridTablePosX;

					if (this.effectiveDir === "rtl") {
						end += celPos.w;
					}

					if (!isDecoration && this.roundToDay) {
						if (!this.isStartOfDay(overlap[1])) {
							end += sign * celPos.w;
						}
					} else {
						end += sign * this.computeProjectionOnDate(dayStart, overlap[1], celPos.w);
					}
				}

				end = Math.floor(end);

				if (this.effectiveDir === "rtl") {
					var t = end;
					end = start;
					start = t;
				}

				if (end > start) { // invalid items are not displayed
					var litem = lang.mixin({
						start: start,
						end: end,
						range: overlap,
						item: item,
						startOffset: startOffset,
						endOffset: endOffset
					}, item);
					layoutItems.push(litem);
				}
			}

			return layoutItems;
		},

		_computeHorizontalOverlapLayout: function (layoutItems, offsets) {
			// tags:
			//		private

			var irHeight = this.horizontalRendererHeight;
			var overlapLayoutRes = this.computeOverlapping(layoutItems, this._overlapLayoutPass3);
			var vOverlap = this.percentOverlap / 100;

			for (var i = 0; i < this.columnCount; i++) {
				var numLanes = overlapLayoutRes.addedPassRes[i];
				var index = this.effectiveDir === "rtl" ? this.columnCount - i - 1 : i;
				if (vOverlap === 0) {
					offsets[index] = numLanes === 0 ? 0 : numLanes == 1 ? irHeight : irHeight + (numLanes - 1) *
						(irHeight + this.verticalGap);
				} else {
					offsets[index] = numLanes === 0 ? 0 : numLanes * irHeight - (numLanes - 1) * (vOverlap * irHeight) +
						this.verticalGap;
				}
				offsets[index] += this.cellPaddingTop;
			}

			return overlapLayoutRes;
		},

		_createLabelLayoutItems: function (/*Integer*/index,
				 /*DateTime*/startTime, /*DateTime*/endTime, /*Object[]*/items) {
			// tags:
			//		private

			if (this.labelRenderer == null) {
				return;
			}

			var d;

			var layoutItems = [];

			for (var i = 0; i < items.length; i++) {
				var item = items[i];

				d = item.startTime.startOf("day");

				// iterate on columns overlapped by this item to create one item per column
				//while(d < item.endTime && d < this.endTime){
				while (d  < item.endTime && d < endTime) {
					var dayEnd = d.plus({ day: 1 }).startOf("day");

					var overlap = this.computeRangeOverlap(item.startTime, item.endTime, d, dayEnd);
					var startOffset = startTime.diff(overlap[0].startOf("day"), "day").days;

					if (startOffset >= this.columnCount) {
						// If the offset is greater than the column count
						// the item will be processed in another row.
						break;
					}

					if (startOffset >= 0) {
						var list = layoutItems[startOffset];
						if (list == null) {
							list = [];
							layoutItems[startOffset] = list;
						}

						list.push(lang.mixin({
							startOffset: startOffset,
							range: overlap,
							item: item
						}, item));
					}

					d = d.plus({ day: 1 }).startOf("day");
				}
			}

			return layoutItems;
		},

		_computeLabelOffsets: function (layoutItems, offsets) {
			// tags:
			//		private

			for (var i = 0; i < this.columnCount; i++) {
				offsets[i] = layoutItems[i] == null ? 0 : layoutItems[i].length *
					(this.labelRendererHeight + this.verticalGap);
			}
		},

		_computeColHasHiddenItems: function (index, hOffsets, lOffsets) {
			// tags:
			//		private

			var res = [];
			var cellH = this._getRowHeight(index);
			var h;
			var maxH = 0;
			for (var i = 0; i < this.columnCount; i++) {
				h = hOffsets == null || hOffsets[i] == null ? this.cellPaddingTop : hOffsets[i];
				h += lOffsets == null || lOffsets[i] == null ? 0 : lOffsets[i];
				if (h > maxH) {
					maxH = h;
				}
				res[i] = h > cellH;
			}

			this.naturalRowsHeight[index] = maxH;
			return res;
		},

		_layoutHorizontalItemsImpl: function (index, layoutItems, hOverlapLayout, hasHiddenItems, hiddenItems,
											  itemsType) {

			// tags:
			//		private

			var cell = this.cells[index];
			var cellH = this._getRowHeight(index);
			var irHeight = this.horizontalRendererHeight;
			var vOverlap = this.percentOverlap / 100;
			var ir, h, w;

			for (var i = 0; i < layoutItems.length; i++) {
				var item = layoutItems[i];
				var lane = item.lane;

				if (itemsType === "dataItems") {

					var posY = this.cellPaddingTop;

					if (vOverlap === 0) {
						//no overlap and a padding between each event
						posY += lane * (irHeight + this.verticalGap);
					} else {
						// an overlap
						posY += lane * (irHeight - vOverlap * irHeight);
					}

					var exp = false;
					var maxH = cellH;
					if (this.expandRenderer) {
						for (var off = item.startOffset; off <= item.endOffset; off++) {
							if (hasHiddenItems[off]) {
								exp = true;
								break;
							}
						}
						maxH = exp ? cellH - this.expandRendererHeight : cellH;
					}

					if (posY + irHeight <= maxH) {

						ir = this._createRenderer(item, "horizontal", this.horizontalRenderer,
							"d-calendar-horizontal");

						var fullHeight = this.isItemBeingEdited(item) && !this.liveLayout && this._isEditing;
						h = fullHeight ? cellH - this.cellPaddingTop : irHeight;
						w = item.end - item.start;

						domStyle.set(ir.container, {
							"top": (fullHeight ? this.cellPaddingTop : posY) + "px",
							"left": item.start + "px",
							"width": w + "px",
							"height": h + "px"
						});

						this._applyRendererLayout(item, ir, cell, w, h, "horizontal");

					} else {
						// The items does not fit in view, fill hidden items per column
						for (var d = item.startOffset; d < item.endOffset; d++) {
							if (hiddenItems[d] == null) {
								hiddenItems[d] = [item.item];
							} else {
								hiddenItems[d].push(item.item);
							}
						}
					}
				} else { //itemsType === "decorationItems"
					ir = this.decorationRendererManager.createRenderer(item, "horizontal",
						this.horizontalDecorationRenderer, "d-calendar-decoration");

					h = cellH;
					w = item.end - item.start;

					domStyle.set(ir.container, {
						"top": "0",
						"left": item.start + "px",
						"width": w + "px",
						"height": h + "px"
					});

					domConstruct.place(ir.container, cell);
					domStyle.set(ir.container, "display", "block");
				}
			}
		},

		_layoutLabelItemsImpl: function (index, layoutItems, hasHiddenItems, hiddenItems, hOffsets) {
			// tags:
			//		private
			var list, posY;
			var cell = this.cells[index];
			var cellH = this._getRowHeight(index);
			var irHeight = this.labelRendererHeight;
			var maxW = domGeometry.getMarginBox(this.itemContainer).w;

			for (var i = 0; i < layoutItems.length; i++) {
				list = layoutItems[i];

				if (list != null) {
					// sort according to start time the list of label renderers
					list.sort(function (a, b) {
						return +(a.range[0]) - +(b.range[0]);
					}.bind(this));

					var maxH = this.expandRenderer ? (hasHiddenItems[i] ? cellH - this.expandRendererHeight : cellH) :
						cellH;
					posY = hOffsets == null || hOffsets[i] == null ? this.cellPaddingTop : hOffsets[i] +
						this.verticalGap;
					var celPos = domGeometry.position(this._getCellAt(index, i));
					var left = celPos.x - this.gridTablePosX;

					for (var j = 0; j < list.length; j++) {

						if (posY + irHeight + this.verticalGap <= maxH) {
							var item = list[j];

							lang.mixin(item, {
								start: left,
								end: left + celPos.w
							});

							var ir = this._createRenderer(item, "label", this.labelRenderer, "d-calendar-label");

							var fullHeight = this.isItemBeingEdited(item) && !this.liveLayout && this._isEditing;
							var h = fullHeight ? this._getRowHeight(index) - this.cellPaddingTop : irHeight;

							if (this.effectiveDir === "rtl") {
								item.start = maxW - item.end;
								item.end = item.start + celPos.w;
							}

							domStyle.set(ir.container, {
								"top": (fullHeight ? this.cellPaddingTop : posY) + "px",
								"left": item.start + "px",
								"width": celPos.w + "px",
								"height": h + "px"
							});

							this._applyRendererLayout(item, ir, cell, celPos.w, h, "label");
						} else {
							break;
						}
						posY += irHeight + this.verticalGap;
					}

					for (; j < list.length; j++) {
						if (hiddenItems[i] == null) {
							hiddenItems[i] = [list[j]];
						} else {
							hiddenItems[i].push(list[j]);
						}
					}
				}
			}
		},

		_applyRendererLayout: function (item, ir, cell, w, h, kind) {
			// tags:
			//		private

			var edited = this.isItemBeingEdited(item);
			var selected = this.isSelected(item);
			var hovered = this.isItemHovered(item);
			var focused = this.isItemFocused(item);

			var renderer = ir.renderer;

			renderer.hovered = hovered;
			renderer.selected = selected;
			renderer.edited = edited;
			renderer.focused = this.showFocus ? focused : false;
			renderer.moveEnabled = this.isItemMoveEnabled(item._item, kind);
			renderer.storeState = this.getItemStoreState(item);

			if (kind != "label") {
				renderer.resizeEnabled = this.isItemResizeEnabled(item, kind);
			}

			this.applyRendererZIndex(item, ir, hovered, selected, edited, focused);

			renderer.w = w;
			renderer.h = h;

			renderer.deliver();

			domConstruct.place(ir.container, cell);
			domStyle.set(ir.container, "display", "block");
		},

		_getCellAt: function (rowIndex, columnIndex, rtl) {
			// tags:
			//		private

			if ((rtl === undefined || rtl) && this.effectiveDir === "rtl") {
				columnIndex = this.columnCount - 1 - columnIndex;
			}
			return this.gridTable.childNodes[0].childNodes[rowIndex].childNodes[columnIndex];
		},

		_layoutExpandRenderers: function (index, hasHiddenItems, hiddenItems) {
			// tags:
			//		private

			if (!this.expandRenderer) {
				return;
			}
			if (this.expandedRow == index) {
				if (this.expandedRowCol != null && this.expandedRowCol != -1) {
					this._layoutExpandRendererImpl(this.expandedRow, this.expandedRowCol, null, true);
				}
			} else {
				if (this.expandedRow == null) {
					for (var i = 0; i < this.columnCount; i++) {
						if (hasHiddenItems[i]) {
							this._layoutExpandRendererImpl(index, this.effectiveDir === "rtl" ?
								this.columnCount - 1 - i : i, hiddenItems[i], false);
						}
					}
				}
			}
		},

		_layoutExpandRendererImpl: function (rowIndex, colIndex, items, expanded) {
			// tags:
			//		private

			var d = this.dates[rowIndex][colIndex];
			var ir = null;
			var cell = this.cells[rowIndex];

			ir = this._getExpandRenderer(d, items, rowIndex, colIndex, expanded);

			var dim = domGeometry.position(this._getCellAt(rowIndex, colIndex));
			dim.x -= this.gridTablePosX;
			this.layoutExpandRenderer(ir, d, items, dim, this.expandRendererHeight);
			domConstruct.place(ir, cell);
			domStyle.set(ir, "display", "block");
		},

		layoutExpandRenderer: function (renderer, date, items, cellPosition, height) {
			// summary:
			//		Computes and sets the position of the expand/collapse renderers.
			//		By default the renderer is set to take the width of the cell
			//		and is placed at the bottom of the cell.
			//		The renderer DOM node is in a row that takes all the grid width.
			// renderer: Object
			//		The renderer used in specified cell that indicates that some items cannot be displayed.
			// date: DateTime
			//		The date displayed by the cell.
			// items: Object[]
			//		The list of non visible items.
			// cellPosition: Object
			//		An object that contains the position (x and y properties) and size of the cell
			//		(w and h properties).
			// tags:
			//		private
			domStyle.set(renderer, {
				"left": cellPosition.x + "px",
				"width": cellPosition.w + "px",
				"height": height + "px",
				"top": (cellPosition.h - height - 1) + "px"
			});
		},

		/////////////////////////////////////////////
		//
		// Editing
		//
		//////////////////////////////////////////////

		_onItemEditBeginGesture: dcl.superCall(function (sup) {
			return function (e) {
				// tags:
				//		private
				var p = this._edProps;

				var item = p.editedItem;
				var dates = e.dates;

				var refTime = p.editKind == "resizeEnd" ? item.endTime : item.startTime;

				if (p.rendererKind == "label") {
					// noop
				} else if (e.editKind == "move" && (item.allDay || this.roundToDay)) {
					p.dayOffset = Math.round(refTime.diff(dates[0].startOf("day"), "day").days);
				} // else managed in super

				sup.apply(this, arguments);
			};
		}),

		_computeItemEditingTimes: dcl.superCall(function (sup) {
			return function (item, editKind, rendererKind, times) {
				var p = this._edProps;

				if (rendererKind == "label") { // noop
				} else if (item.allDay || this.roundToDay) {
					var isStartOfDay = this.isStartOfDay(times[0]);
					switch (editKind) {
					case "resizeEnd":
						if (!isStartOfDay && item.allDay) {
							times[0] = times[0].plus({ day: 1 });
						}
						/* falls through */
					case "resizeStart":
						if (!isStartOfDay) {
							times[0] = times[0].starfOf("day");
						}
						break;
					case "move":
						times[0] = times[0].plus({ day: p.dayOffset });
						break;
					case "resizeBoth":
						if (!isStartOfDay) {
							times[0] = times[0].startOf("day");
						}
						if (!this.isStartOfDay(times[1])) {
							times[1] = times[1].plus({ day: 1}).startOf("day");
						}
						break;
					}

				} else {
					times = sup.apply(this, arguments);
				}

				return times;
			};
		}),


		/////////////////////////////////////////////
		//
		// Pixel to Time projection
		//
		//////////////////////////////////////////////

		getTime: function (e, x, y, touchIndex) {
			// summary:
			//		Returns the time displayed at the specified point by this component.
			// e: Event
			//		Optional mouse event.
			// x: Number
			//		Position along the x-axis with respect to the sheet container used if event is not defined.
			// y: Number
			//		Position along the y-axis with respect to the sheet container (scroll included)
			//		used if event is not defined.
			// touchIndex: Integer
			//		If parameter 'e' is not null and a touch event, the index of the touch to use.
			// returns: DateTime

			if (e != null) {
				var refPos = domGeometry.position(this.itemContainer, true);

				if (e.touches) {
					touchIndex = touchIndex === undefined ? 0 : touchIndex;

					x = e.touches[touchIndex].pageX - refPos.x;
					y = e.touches[touchIndex].pageY - refPos.y;
				} else {
					x = e.pageX - refPos.x;
					y = e.pageY - refPos.y;
				}
			}

			var r = domGeometry.getContentBox(this.itemContainer);

			if (x < 0) {
				x = 0;
			} else if (x > r.w) {
				x = r.w - 1;
			}

			if (y < 0) {
				y = 0;
			} else if (y > r.h) {
				y = r.h - 1;
			}

			// compute the date from column the time in day instead of time from start date of row
			// to prevent DST hour offset.

			var w = domGeometry.getMarginBox(this.itemContainer).w;
			var colW = w / this.columnCount;

			var row;
			if (this.expandedRow == null) {
				row = Math.floor(y / (domGeometry.getMarginBox(this.itemContainer).h / this.rowCount));
			} else {
				row = this.expandedRow; //other rows are not usable
			}

			if (this.effectiveDir === "rtl") {
				x = r.w - x;
			}

			var col = Math.floor(x / colW);

			var tm = Math.floor((x - (col * colW)) * 1440 / colW);

			var date = null;
			if (row < this.dates.length && col < this.dates[row].length) {
				date = this.dates[row][col].add({ minute: tm });
			}

			return date;
		},

		/////////////////////////////////////////////
		//
		// Event management
		//
		//////////////////////////////////////////////

		_onGridMouseUp: dcl.superCall(function (sup) {
			return function (e) {
				sup.apply(this, arguments);

				if (this._gridMouseDown) {
					this._gridMouseDown = false;

					this.emit("grid-click", {
						date: this.getTime(e),
						triggerEvent: e
					});
				}
			};
		}),

		_onGridTouchEnd: dcl.superCall(function (sup) {
			return function (e) {
				sup.apply(this, arguments);

				var g = this._gridProps;

				if (g) {
					if (!this._isEditing) {
						// touched on grid and on touch start editing was ongoing.
						if (!g.fromItem && !g.editingOnStart) {
							this.selectFromEvent(e, null, null, true);
						}

						if (!g.fromItem) {
							if (this._pendingDoubleTap && this._pendingDoubleTap.grid) {
								this.emit("grid-double-click", {
									date: this.getTime(this._gridProps.event),
									triggerEvent: this._gridProps.event
								});

								clearTimeout(this._pendingDoubleTap.timer);

								delete this._pendingDoubleTap;
							} else {
								this.emit("grid-click", {
									date: this.getTime(this._gridProps.event),
									triggerEvent: this._gridProps.event
								});

								this._pendingDoubleTap = {
									grid: true,
									timer: this.defer(function () {
										delete this._pendingDoubleTap;
									}, this.doubleTapDelay)
								};
							}
						}
					}

					this._gridProps = null;
				}
			};
		}),


		/////////////////////////////////////////////
		//
		// Events
		//
		//////////////////////////////////////////////

		expandRendererClickHandler: function (clickEvent, renderer) {
			// summary:
			//		Default action when an expand renderer is clicked.
			// clickEvent: Event
			//		The native mouse event.
			// renderer: Object
			//		The expand renderer.
			// tags:
			//		protected

			clickEvent.stopPropagation();

			var synthEvent = this.emit("expand-renderer-click", {
				render: renderer,
				triggerEvent: clickEvent
			});

			if (!synthEvent.defaultPrevented) {
				if (this.getExpandedRowIndex() != -1) {
					this.collapseRow();
				} else {
					this.expandRow(clickEvent.rowIndex, clickEvent.columnIndex);
				}
			}
		},


		////////////////////////////////////////////
		//
		// Editing
		//
		///////////////////////////////////////////

		snapUnit: "minute",
		snapSteps: 15,
		minDurationUnit: "minute",
		minDurationSteps: 15,
		triggerExtent: 3,
		liveLayout: false,
		stayInView: true,
		allowStartEndSwap: true,
		allowResizeLessThan24H: false
	});
});
