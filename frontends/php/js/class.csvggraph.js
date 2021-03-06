/*
 ** Zabbix
 ** Copyright (C) 2001-2018 Zabbix SIA
 **
 ** This program is free software; you can redistribute it and/or modify
 ** it under the terms of the GNU General Public License as published by
 ** the Free Software Foundation; either version 2 of the License, or
 ** (at your option) any later version.
 **
 ** This program is distributed in the hope that it will be useful,
 ** but WITHOUT ANY WARRANTY; without even the implied warranty of
 ** MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 ** GNU General Public License for more details.
 **
 ** You should have received a copy of the GNU General Public License
 ** along with this program; if not, write to the Free Software
 ** Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 **/


/**
 * JQuery class that initializes interactivity for SVG graph. Currently following features are supported:
 *  - SBox - time range selector;
 *  - show_problems - show problems in hintbox when mouse is moved over the problem zone;
 *  - min_period - min period in seconds that must be s-boxed to change the data in dashboard timeselector.
 */
jQuery(function ($) {
	"use strict";

	// Makes SBox selection cancelable pressing Esc.
	function sBoxKeyboardInteraction(e) {
		if (e.keyCode == 27) {
			destroySBox(e, e.data.graph);
		}
	}

	// Cancel SBox and unset its variables.
	function destroySBox(e, graph) {
		var graph = graph || e.data.graph;

		$('.svg-graph-selection', graph).attr({'width': 0, 'height': 0});
		$('.svg-graph-selection-text', graph).text('');

		$(document).off('keydown', {graph: graph}, sBoxKeyboardInteraction);

		graph
			.off('mousemove', moveSBoxMouse)
			.off('mouseup', destroySBox);
		graph.data('options').boxing = false;
	}

	// Destroy hintbox, unset its variables and event listeners.
	function destroyHintbox(graph) {
		var data = graph.data('options'),
			hbox = graph.data('hintbox') || null;

		if (hbox !== null && data.isHintBoxFrozen === false) {
			graph.off('mouseup', makeHintboxStatic);
			graph.removeData('hintbox');
			hbox.remove();
		}
	}

	// Hide vertical helper line and highlighted data points.
	function hideHelper(graph) {
		graph.find('.svg-helper').attr({'x1': -10, 'x2': -10});
		graph.find('.svg-point-highlight').attr({'cx': -10, 'cy': -10});
	}

	// Create a new hintbox and stick it to certain position where user has clicked.
	function makeHintboxStatic(e, graph) {
		var graph = graph || e.data.graph,
			data = graph.data('options'),
			hbox = graph.data('hintbox'),
			content = hbox.find('> div');

		// Destroy old hintbox to make new one with close button.
		destroyHintbox(graph);

		// Should be put inside hintBoxItem to use functionality of hintBox.
		graph.hintBoxItem = hintBox.createBox(e, graph, content, '', true, false, graph.parent());
		data.isHintBoxFrozen = true;

		graph.hintBoxItem.on('onDeleteHint.hintBox', function(e) {
			data.isHintBoxFrozen = false; // Unfreeze because only onfrozen hintboxes can be removed.
			graph.off('mouseup', hintboxSilentMode);
			destroyHintbox(graph);
		});

		repositionHintBox(e, graph);
		graph
			.off('mouseup', hintboxSilentMode)
			.on('mouseup', {graph: graph}, hintboxSilentMode);
		graph.data('hintbox', graph.hintBoxItem);
	}

	/**
	 * Silent mode means that hintbox is waiting for click to be repositionated. Once user clicks on graph, existing
	 * hintbox will be repositionated with a new values in the place where user clicked on.
	 */
	function hintboxSilentMode(e) {
		var graph = e.data.graph,
			data = graph.data('options');

		data.isHintBoxFrozen = false;
		showHintbox(e, graph);
		makeHintboxStatic(e, graph);
	}

	// Method to start selection of some horizontal area in graph.
	function startSBoxDrag(e) {
		e.stopPropagation();

		var graph = e.data.graph,
			data = graph.data('options');

		if (data.dimX <= e.offsetX && e.offsetX <= data.dimX + data.dimW && data.dimY <= e.offsetY
				&& e.offsetY <= data.dimY + data.dimH) {
			$(document).on('keydown', {graph: graph}, sBoxKeyboardInteraction);

			graph
				.on('mousemove', {graph: graph}, moveSBoxMouse)
				.on('mouseup', {graph: graph}, destroySBox);

			data.start = e.offsetX - data.dimX;
		}
	}

	// Method to recalculate selected area during mouse move.
	function moveSBoxMouse(e) {
		e.stopPropagation();

		var graph = e.data.graph,
			data = graph.data('options'),
			sbox = $('.svg-graph-selection', graph),
			stxt = $('.svg-graph-selection-text', graph);

		if ((e.offsetX - data.dimX) > 0 && (data.dimW + data.dimX) >= e.offsetX) {
			data.end = e.offsetX - data.dimX;
			if (data.start != data.end) {
				data.isHintBoxFrozen = false;
				data.boxing = true;
				destroyHintbox(graph);
				hideHelper(graph);
			}
			else {
				destroySBox(e, graph);
				return false;
			}

			data.end = Math.min(e.offsetX - data.dimX, data.dimW);

			sbox.attr({
				'x': (Math.min(data.start, data.end) + data.dimX) + 'px',
				'y': data.dimY + 'px',
				'width': Math.abs(data.end - data.start) + 'px',
				'height': data.dimH
			});

			var seconds = Math.round(Math.abs(data.end - data.start) * data.spp),
				label = formatTimestamp(seconds, false, true)
					+ (seconds < data.minPeriod ? ' [min 1' + locale['S_MINUTE_SHORT'] + ']'  : '');

			stxt
				.text(label)
				.attr({
					'x': (Math.min(data.start, data.end) + data.dimX + 5) + 'px',
					'y': (data.dimY + 15) + 'px'
				});
		}
	}

	// Method to end selection of horizontal area in graph.
	function endSBoxDrag(e) {
		e.stopPropagation();

		var graph = e.data.graph,
			data = graph.data('options');

		if (data.boxing) {
			data.end = Math.min(e.offsetX - data.dimX, data.dimW);

			destroySBox(e, graph);

			var seconds = Math.round(Math.abs(data.end - data.start) * data.spp),
				from_offset = Math.floor(Math.min(data.start, data.end)) * data.spp,
				to_offset = Math.floor(data.dimW - Math.max(data.start, data.end)) * data.spp;

			if (seconds > data.minPeriod && (from_offset > 0 || to_offset > 0)) {
				$.publish('timeselector.rangeoffset', {
					from_offset: Math.ceil(from_offset),
					to_offset: Math.ceil(to_offset)
				});
			}
		}
	}

	// Read SVG nodes and find closest past value to the given x in each data set.
	function findValues(graph, x) {
		var data_sets = [],
			nodes = graph.querySelectorAll('[data-set]');

		for (var i = 0, l = nodes.length; l > i; i++) {
			var px = -10,
				py = -10,
				pv = null;

			// Find matching X points.
			switch (nodes[i].getAttribute('data-set')) {
				case 'points':
					var test_x = Math.min(x, +nodes[i].lastChild.getAttribute('cx')),
						circle_nodes = nodes[i].querySelectorAll('circle'),
						points = [];

					for (var c = 0, cl = circle_nodes.length; cl > c; c++) {
						if (test_x >= parseInt(circle_nodes[c].getAttribute('cx'))) {
							points.push(circle_nodes[c]);
						}
					}

					var point = points.slice(-1)[0];
					if (typeof point !== 'undefined') {
						px = point.getAttribute('cx');
						py = point.getAttribute('cy');
						pv = point.getAttribute('label');
					}
					break;

				case 'staircase':
				case 'line':
					var direction_string = '',
						label = [],
						data_set = nodes[i].getAttribute('data-set'),
						paths = nodes[i].querySelectorAll('.svg-graph-line');

					for (var index = 0, len = paths.length; index < len; index++) {
						direction_string += ' ' + paths[index].getAttribute('d');
						label.push(paths[index].getAttribute('data-label'));
					}

					label = label.join(',').split(',');

					var direction = (IE || ED) // IE11 & Edge transforms 'd' attribute.
							? direction_string.substr(1).replace(/([ML])\s(\d+)\s(\d+)/g, '$1$2\,$3').split(' ')
							: direction_string.substr(1).split(' '),
						index = direction.length,
						point;

					while (index) {
						index--;
						point = direction[index].substr(1).split(',');
						if (x >= parseInt(point[0])) {
							px = point[0];
							py = point[1];
							pv = label[data_set === 'line' ? index : Math.ceil(index / 2)];
							break;
						}
					}
					break;
			}

			data_sets.push({g: nodes[i], x: px, y: py, v: pv});
		}

		return data_sets;
	}

	// Find what problems matches in time to the given x.
	function findProblems(graph, x) {
		var problems = [],
			problem_start,
			problem_width,
			nodes = graph.querySelectorAll('[data-info]');

		for (var i = 0, l = nodes.length; l > i; i++) {
			problem_start = +nodes[i].getAttribute('x');
			problem_width = +nodes[i].getAttribute('width');

			if (x > problem_start && problem_start + problem_width > x) {
				problems.push(JSON.parse(nodes[i].getAttribute('data-info')));
			}
		}

		return problems;
	}

	// Set position of vertical helper line.
	function setHelperPosition(e, graph) {
		var data = graph.data('options');
		graph.find('.svg-helper').attr({
			'x1': e.clientX - graph.offset().left,
			'y1': data.dimY,
			'x2': e.clientX - graph.offset().left,
			'y2': data.dimY + data.dimH
		});
	}

	/**
	 * Get tolerance for given data set. Tolerance is used to find which elements are hovered by mouse. Script takes
	 * actual data point and adds N pixels to all sides. Then looks if mouse is in calculated area. N is calculated by
	 * this function. Tolerance is used to find exacly macthed point only.
	 */
	function getDataPointTolerance(ds) {
		if (ds.getAttribute('data-set') === 'points') {
			// Take radius of first real data set point (the 0th is .svg-point-highlight).
			return +ds.childNodes[1].getAttribute('r');
		}
		else {
			return +window.getComputedStyle(ds.querySelectorAll('path')[0])['strokeWidth'];
		}
	}

	// Position hintbox near current mouse position.
	function repositionHintBox(e, graph) {
		var hbox = $(graph.hintBoxItem),
			offsetX = e.clientX - graph.offset().left,
			l = (document.body.clientWidth >= offsetX + hbox.width()) ? offsetX : offsetX - hbox.width(),
			t = (window.screen.height >= e.screenY + hbox.height() + 60) ? e.offsetY + 60 : e.offsetY - hbox.height();
		hbox.css({'left': l, 'top': t});
	}

	// Show problem or value hintbox.
	function showHintbox(e, graph) {
		e.stopPropagation();

		var graph = graph || e.data.graph,
			data = graph.data('options'),
			hbox = graph.data('hintbox') || null,
			offsetX = e.clientX - graph.offset().left,
			html = null,
			inx = false;
		if (data.boxing === false) {
			// Check if mouse in the horizontal area in which hintbox must be shown.
			inx = (data.dimX <= offsetX && offsetX <= data.dimX + data.dimW);

			// Show problems when mouse is in the 15px high area under the graph canvas.
			if (data.showProblems && data.isHintBoxFrozen === false && inx && data.dimY + data.dimH <= e.offsetY
					&& e.offsetY <= data.dimY + data.dimH + 15) {
				hideHelper(graph);

				var values = findProblems(graph[0], e.offsetX);
				if (values.length) {
					var tbody = $('<tbody>'),
						foot = null;

					values.forEach(function(val, i) {
						if (i >= data.hintMaxRows) {
							var msg = sprintf(t('Displaying %1$s of %2$s found'), data.hintMaxRows, values.length);
							foot = $('<div></div>')
										.addClass('table-paging')
										.append(
											$('<div></div>')
												.addClass('paging-btn-container')
												.append(
													$('<div></div>')
														.addClass('table-stats')
														.text(msg)
												)
										);
							return;
						}

						tbody.append(
							$('<tr>')
								.append($('<td>').append($('<a>', {'href': val.url}).text(val.clock)))
								.append($('<td>').append(val.r_eventid
									? $('<a>', {'href': val.url}).text(val.r_clock)
									: val.r_clock)
								)
								.append($('<td>').append($('<span>', {'class': val.status_color}).text(val.status)))
								.append($('<td>', {'class': val.severity}).text(val.name))
						);
					});

					html = $('<div></div>')
							.addClass('svg-graph-hintbox')
							.append(
								$('<table></table>')
									.addClass('list-table compact-view')
									.append(tbody)
							)
							.append(foot);
				}
			}
			// Show graph values if mouse is over the graph canvas.
			else if (inx && data.dimY <= e.offsetY && e.offsetY <= data.dimY + data.dimH) {
				// Set position of mouse following helper line.
				setHelperPosition(e, graph);

				// Find values.
				var points = findValues(graph[0], offsetX),
					show_hint = false,
					xy_point = false,
					foot = null,
					tolerance;

				/**
				 * Decide if one specific value or list of all matching Xs should be highlighted and either to show or
				 * hide hintbox.
				 */
				if (data.isHintBoxFrozen === false) {
					points.forEach(function(point) {
						if (!show_hint && point.v !== null) {
							show_hint = true;
						}

						tolerance = getDataPointTolerance(point.g);
						if (!xy_point && point.v !== null
								&& (+point.x + tolerance) > e.offsetX && e.offsetX > (+point.x - tolerance)
								&& (+point.y + tolerance) > e.offsetY && e.offsetY > (+point.y - tolerance)) {
							xy_point = point;
							return;
						}
					});
				}

				// Make html for hintbox.
				if (show_hint) {
					html = $('<ul></ul>');
				}
				points.forEach(function(point, i) {
					var point_highlight = point.g.querySelectorAll('.svg-point-highlight')[0];
					if (xy_point === false || xy_point === point) {
						point_highlight.setAttribute('cx', point.x);
						point_highlight.setAttribute('cy', point.y);

						if (show_hint && data.hintMaxRows > i) {
							$('<li></li>')
								.append(
									$('<span></span>')
										.css('background-color', point.g.getAttribute('data-color'))
										.addClass('svg-graph-hintbox-item-color')
								)
								.append(point.g.getAttribute('data-metric') + ': ' + point.v)
								.appendTo(html);
						}
					}
					else {
						point_highlight.setAttribute('cx', -10);
						point_highlight.setAttribute('cy', -10);
					}
				});

				if (points.length > data.hintMaxRows) {
					var msg = sprintf(t('Displaying %1$s of %2$s found'), data.hintMaxRows, points.length);
					foot = $('<div></div>')
								.addClass('table-paging')
								.append(
									$('<div></div>')
										.addClass('paging-btn-container')
										.append(
											$('<div></div>')
												.addClass('table-stats')
												.text(msg)
										)
								);
				}

				if (show_hint) {
					html = $('<div></div>')
							.addClass('svg-graph-hintbox')
							.append(html)
							.append(foot);
				}
			}
			else {
				hideHelper(graph);
			}

			if (html !== null) {
				if (hbox === null) {
					hbox = hintBox.createBox(e, graph, html, '', false, false, graph.parent());
					graph.on('mouseup', {graph: graph}, makeHintboxStatic);
					graph.data('hintbox', hbox);
				}
				else {
					hbox.find('> div').replaceWith(html);
				}

				graph.hintBoxItem = hbox;
				repositionHintBox(e, graph);
			}
		}
		else {
			hideHelper(graph);
		}

		if (html === null) {
			destroyHintbox(graph);
		}
	}

	var methods = {
		init: function(options) {
			options = $.extend({}, {
				sbox: false,
				show_problems: true,
				hint_max_rows: 20,
				min_period: 60
			}, options);

			this.each(function() {
				var graph = $(this),
					data = {
						dimX: options.dims.x,
						dimY: options.dims.y,
						dimW: options.dims.w,
						dimH: options.dims.h,
						showProblems: options.show_problems,
						hintMaxRows: options.hint_max_rows,
						isHintBoxFrozen: false,
						spp: options.spp || null,
						minPeriod: options.min_period,
						boxing: false
					};

				graph
					.on('mouseleave', function(e) {
						var graph = $(this);
						destroyHintbox(graph);
						destroySBox(e, graph);
						hideHelper(graph);
						return false;
					})
					.data('options', data)
					.on('mousemove', {graph: graph}, showHintbox)
					.attr('unselectable', 'on')
					.css('user-select', 'none')
					.on('selectstart', false);

				if (options.sbox) {
					graph
						.on('mousedown', {graph: graph}, startSBoxDrag)
						.on('mouseup', {graph: graph}, endSBoxDrag);
				}
			});
		},
		disableSBox: function(e) {
			var graph = $(this);

			destroySBox(e, graph);
			graph
				.off('mousedown', startSBoxDrag)
				.off('mouseup', endSBoxDrag);
		}
	};

	$.fn.svggraph = function(method) {
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		else {
			return methods.init.apply(this, arguments);
		}
	};
});
