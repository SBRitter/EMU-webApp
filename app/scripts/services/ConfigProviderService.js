'use strict';

angular.module('emuwebApp')
	.service('ConfigProviderService', function (viewState) {

		// shared service object
		var sServObj = {};
		sServObj.vals = {};
		sServObj.curDbConfig = {};

		// embedded values -> if these are set this overrides the normal config  
		sServObj.embeddedVals = {
			audioGetUrl: '',
			labelGetUrl: '',
			labelType: '',
			fromUrlParams: false
		};

		/**
		 * depth of 2 = max
		 */
		sServObj.setVals = function (data) {
			if ($.isEmptyObject(sServObj.vals)) {
				sServObj.vals = data;
			} else {
				angular.forEach(Object.keys(data), function (key1) {
					// if array... overwrite entire thing!
					if (angular.isArray(sServObj.vals[key1])) {
						//empty array
						sServObj.vals[key1] = [];
						angular.forEach(data[key1], function (itm) {
							sServObj.vals[key1].push(itm);
						});
					} else {
						angular.forEach(Object.keys(data[key1]), function (key2) {
							if (sServObj.vals[key1][key2] !== undefined) {
								sServObj.vals[key1][key2] = data[key1][key2];
							} else {
								console.error('BAD ENTRY IN CONFIG! Key1: ' + key1 + ' key2: ' + key2);
							}
						});
					}

				});
			}
		};

		/**
		 *
		 */
		sServObj.getSsffTrackConfig = function (name) {
			var res;
			if (sServObj.curDbConfig.ssffTrackDefinitions !== undefined) {
				angular.forEach(sServObj.curDbConfig.ssffTrackDefinitions, function (tr) {
					if (tr.name === name) {
						res = tr;
					}
				});
			}
			return res;
		};

		/**
		 *
		 */
		sServObj.getLimsOfTrack = function (trackName) {
			var res = {};
			angular.forEach(sServObj.vals.perspectives[viewState.curPerspectiveIdx].signalCanvases.contourLims, function (cL) {
				if (cL.ssffTrackName === trackName) {
					res = cL;
				}
			});

			return res;
		};

		/**
		 *
		 */
		sServObj.getContourColorsOfTrack = function (trackName) {
			var res;
			angular.forEach(sServObj.vals.perspectives[viewState.curPerspectiveIdx].signalCanvases.contourColors, function (cC) {
				if (cC.ssffTrackName === trackName) {
					res = cC;
				}
			});

			return res;
		};

		/**
		 *
		 */
		sServObj.getAssignment = function (signalName) {
			var res = {};
			angular.forEach(sServObj.vals.perspectives[viewState.curPerspectiveIdx].signalCanvases.assign, function (a) {
				if (a.signalCanvasName === signalName) {
					res = a;
				}
			});

			return res;
		};

		/**
		 *
		 */
		sServObj.getLevelDefinition = function (levelName) {
			var res = {};
			angular.forEach(sServObj.curDbConfig.levelDefinitions, function (ld) {
				if (ld.name === levelName) {
					res = ld;
				}
			});

			return res;
		};
		
		/**
		 *  replace ascii codes from config with strings
		 */		
		sServObj.getStrRep = function (code) {
			var str;
			switch (code) {
			case 8:
				str = 'BACKSPACE';
				break;
			case 9:
				str = 'TAB';
				break;
			case 13:
				str = 'ENTER';
				break;
			case 16:
				str = 'SHIFT';
				break;
			case 18:
				str = 'ALT';
				break;
			case 32:
				str = 'SPACE';
				break;
			case 37:
				str = '←';
				break;
			case 39:
				str = '→';
				break;
			case 38:
				str = '↑';
				break;
			case 40:
				str = '↓';
				break;
			case 42:
				str = '+';
				break;
			case 43:
				str = '+';
				break;								
			case 45:
				str = '-';
				break;
			case 95:
				str = '-';
				break;				
			default:
				str = String.fromCharCode(code);
			}
			return str;
		};		



		return sServObj;

	});