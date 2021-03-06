'use strict';

angular.module('emuwebApp')
	.controller('MainController', function ($scope, $rootScope, $log, $compile, $timeout,
	                                        $q, $window, $document, $location, viewState, HistoryService, Iohandlerservice,
	                                        Soundhandlerservice, ConfigProviderService, fontScaleService, Ssffdataservice,
	                                        LevelService, Textgridparserservice, Espsparserservice,
	                                        Binarydatamaniphelper, Wavparserservice, Ssffparserservice, Drawhelperservice,
	                                        Validationservice, Appcachehandler, loadedMetaDataService, dbObjLoadSaveService,
	                                        appStateService, DataService, modalService, browserDetector) {
		// hook up services to use abbreviated forms
		$scope.cps = ConfigProviderService;
		$scope.hists = HistoryService;
		$scope.fontImage = fontScaleService;
		$scope.levServ = LevelService;
		$scope.dataServ = DataService;
		$scope.vs = viewState;
		$scope.ssffds = Ssffdataservice;
		$scope.shs = Soundhandlerservice;
		$scope.dhs = Drawhelperservice;
		$scope.wps = Wavparserservice;
		$scope.io = Iohandlerservice;
		$scope.ach = Appcachehandler;
		$scope.lmds = loadedMetaDataService;

		// init vars
		$scope.connectBtnLabel = 'connect';
		$scope.tmp = {};
		$scope.dbLoaded = false;
		$scope.is2dCancasesHidden = true;
		$scope.windowWidth = $window.outerWidth;
		$scope.internalVars = {};
		$scope.internalVars.showAboutHint = false;// this should probably be moved to viewState


		// check for new version
		$scope.ach.checkForNewVersion();

		//////////////
		// bindings

		// bind window resize event
		angular.element($window).bind('resize', function () {
			LevelService.deleteEditArea();
			viewState.setWindowWidth($window.outerWidth);
			if (viewState.hierarchyState.isShown()) {
				++viewState.hierarchyState.resize;
			}
			$scope.$digest();
		});

		// bind shift/alt keyups for history
		angular.element($window).bind('keyup', function (e) {
			if (e.keyCode === ConfigProviderService.vals.keyMappings.shift || e.keyCode === ConfigProviderService.vals.keyMappings.alt) {
				HistoryService.addCurChangeObjToUndoStack();
				$scope.$digest();
			}
		});

		// bind focus check for mouse on window and document ( mouse inside )
		angular.element($window).bind('blur', function () {
			viewState.focusOnEmuWebApp = false;
		});

		// bind focus check for mouse on window and document ( mouse inside )
		angular.element($document).bind('blur', function () {
			viewState.focusOnEmuWebApp = false;
		});

		// bind blur check for mouse on window and document ( mouse outside )
		angular.element($window).bind('focus', function () {
			viewState.focusOnEmuWebApp = true;
		});

		// bind blur check for mouse on window and document ( mouse outside )
		angular.element($document).bind('focus', function () {
			viewState.focusOnEmuWebApp = true;
		});

		// Take care of preventing navigation out of app (only if something is loaded, not in embedded mode and not developing (auto connecting))
		window.onbeforeunload = function () {
			if (ConfigProviderService.embeddedVals.audioGetUrl === '' && loadedMetaDataService.getBundleList().length > 0 && !ConfigProviderService.vals.main.autoConnect) {
				return 'Do you really wish to leave/reload the EMU-webApp? All unsaved changes will be lost...';
			}
		};

		//////////////
		// watches
		// watch if embedded override (if attributes are set on emuwebapp tag)
		// $scope.$watch('cps.embeddedVals.audioGetUrl', function (val) {
		// 	if (val !== undefined && val !== '') {
		// 		// check if both are set
		// 		$scope.loadFilesForEmbeddedApp();
		// 	}

		// }, true);

		//
		//////////////

		/////////////
		// listens

		// listen for connectionDisrupted event -> I don't like listens but in this case it might me the way to go...
		$scope.$on('connectionDisrupted', function () {
			appStateService.resetToInitState();
		});

		// listen for resetToInitState
		$scope.$on('resetToInitState', function () {
			$scope.loadDefaultConfig();
		});
		
		$scope.$on('reloadToInitState', function (event, data) {
			$scope.loadDefaultConfig();
			viewState.url = data.url;
			viewState.somethingInProgressTxt = 'Connecting to server...';
			viewState.somethingInProgress = true;
			Iohandlerservice.wsH.initConnect(data.url).then(function (message) {
				if (message.type === 'error') {
					modalService.open('views/error.html', 'Could not connect to websocket server: ' + data.url).then(function () {
						appStateService.resetToInitState();
					});
				} else {
					$scope.handleConnectedToWSserver(data);
				}
			}, function (errMess) {
				modalService.open('views/error.html', 'Could not connect to websocket server: ' + JSON.stringify(errMess, null, 4)).then(function () {
					appStateService.resetToInitState();
				});
			});
		});

		//
		////////////

		// check if URL parameters are set -> if so set embedded flags! SIC this should probably be moved to loadFilesForEmbeddedApp
		var searchObject = $location.search();
		if (searchObject.audioGetUrl && searchObject.labelGetUrl && searchObject.labelType) {
			ConfigProviderService.embeddedVals.audioGetUrl = searchObject.audioGetUrl;
			ConfigProviderService.embeddedVals.labelGetUrl = searchObject.labelGetUrl;
			ConfigProviderService.embeddedVals.labelType = searchObject.labelType;
			ConfigProviderService.embeddedVals.fromUrlParams = true;
		}

		/**
		 *
		 */
		$scope.loadFilesForEmbeddedApp = function () {
            var searchObject = $location.search();
			if (searchObject.audioGetUrl) {
                ConfigProviderService.embeddedVals.audioGetUrl = searchObject.audioGetUrl;
				ConfigProviderService.vals.activeButtons.openDemoDB = false;
				Iohandlerservice.httpGetPath(ConfigProviderService.embeddedVals.audioGetUrl, 'arraybuffer').then(function (data) {
					viewState.showDropZone = false;
					// set bundle name
					var tmp = ConfigProviderService.embeddedVals.audioGetUrl;
					loadedMetaDataService.setCurBndlName(tmp.substr(0, tmp.lastIndexOf('.')).substr(tmp.lastIndexOf('/') + 1, tmp.length));

					//hide menu
					if (viewState.getsubmenuOpen()) {
						viewState.toggleSubmenu(ConfigProviderService.design.animation.period);
					}

					viewState.somethingInProgressTxt = 'Loading DB config...';

					// test if DBconfigGetUrl is set if so use it
					var DBconfigGetUrl;
					if (searchObject.DBconfigGetUrl){
						DBconfigGetUrl = searchObject.DBconfigGetUrl;
					}else{
						DBconfigGetUrl = 'configFiles/embedded_emuwebappConfig.json';
					}

					// then get the DBconfigFile
					Iohandlerservice.httpGetPath(DBconfigGetUrl).then(function (resp) {
						// first element of perspectives is default perspective
						viewState.curPerspectiveIdx = 0;
						ConfigProviderService.setVals(resp.data.EMUwebAppConfig);
						// validate emuwebappConfigSchema
						var validRes = Validationservice.validateJSO('emuwebappConfigSchema', ConfigProviderService.vals);
						if (validRes === true) {
							// turn of keybinding only on mouseover
							if (ConfigProviderService.embeddedVals.fromUrlParams) {
								ConfigProviderService.vals.main.catchMouseForKeyBinding = false;
							}
							ConfigProviderService.curDbConfig = resp.data;

							// validate DBconfigFileSchema!
							validRes = Validationservice.validateJSO('DBconfigFileSchema', ConfigProviderService.curDbConfig);

							if (validRes === true) {

								var bndlList = [{'session': 'File(s)', 'name': 'from URL parameters'}];
								loadedMetaDataService.setBundleList(bndlList);
								loadedMetaDataService.setCurBndl(bndlList[0]);

								// set wav file
								viewState.somethingInProgress = true;
								viewState.somethingInProgressTxt = 'Parsing WAV file...';

								Wavparserservice.parseWavAudioBuf(data.data).then(function (messWavParser) {
									var audioBuffer = messWavParser;
									viewState.curViewPort.sS = 0;
									viewState.curViewPort.eS = audioBuffer.length;
									viewState.resetSelect();
									Soundhandlerservice.audioBuffer = audioBuffer;
									
									var respType;
									if(ConfigProviderService.embeddedVals.labelType === 'TEXTGRID'){
										respType = 'text';
									}else{
										// setting everything to text because the BAS webservices somehow respond with a 
										// 200 (== successful response) but the data field is empty
										respType = 'text'; 
									}
									// get + parse file
									if(searchObject.labelGetUrl){
										Iohandlerservice.httpGetPath(ConfigProviderService.embeddedVals.labelGetUrl, respType).then(function (data2) {
											viewState.somethingInProgressTxt = 'Parsing ' + ConfigProviderService.embeddedVals.labelType + ' file...';
											Iohandlerservice.parseLabelFile(data2.data, ConfigProviderService.embeddedVals.labelGetUrl, 'embeddedTextGrid', ConfigProviderService.embeddedVals.labelType).then(function (parseMess) {

												var annot = parseMess;
												DataService.setData(annot);

												// if no DBconfigGetUrl is given generate levelDefs and co. from annotation
												if (!searchObject.DBconfigGetUrl){

													var lNames = [];
													var levelDefs = [];
													annot.levels.forEach(function (l) {
														lNames.push(l.name);
														levelDefs.push({
															'name': l.name,
															'type': l.type,
															'attributeDefinitions': {
																'name': l.name,
																'type': 'string'
															}
														});
													});

													ConfigProviderService.curDbConfig.levelDefinitions = levelDefs;

													ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].levelCanvases.order = lNames;
												}

												viewState.setCurLevelAttrDefs(ConfigProviderService.curDbConfig.levelDefinitions);

												viewState.somethingInProgressTxt = 'Done!';
												viewState.somethingInProgress = false;
												viewState.setState('labeling');

											}, function (errMess) {
												modalService.open('views/error.html', 'Error parsing wav file: ' + errMess.status.message);
											});

										}, function (errMess) {
											modalService.open('views/error.html', 'Could not get label file: ' + ConfigProviderService.embeddedVals.labelGetUrl + ' ERROR ' + JSON.stringify(errMess.message, null, 4));
										});
                                    }else{
										// hide download + search buttons
										ConfigProviderService.vals.activeButtons.downloadAnnotation = false;
                                        ConfigProviderService.vals.activeButtons.downloadTextGrid = false;
                                        ConfigProviderService.vals.activeButtons.search = false;
                                        viewState.somethingInProgressTxt = 'Done!';
                                        viewState.somethingInProgress = false;
                                        viewState.setState('labeling');
									}


								}, function (errMess) {
									modalService.open('views/error.html', 'Error parsing wav file: ' + errMess.status.message);
								});

							} else {
								modalService.open('views/error.html', 'Error validating / checking DBconfig: ' + JSON.stringify(validRes, null, 4));
							}
						} else {
							modalService.open('views/error.html', 'Error validating ConfigProviderService.vals (emuwebappConfig data) after applying changes of newly loaded config (most likely due to wrong entry...): ' + JSON.stringify(validRes, null, 4));
						}

					}, function (errMess) {
						modalService.open('views/error.html', 'Could not get embedded_config.json: ' + errMess);
					});
				}, function (errMess) {
					modalService.open('views/error.html', 'Could not get audio file:' + ConfigProviderService.embeddedVals.audioGetUrl + ' ERROR: ' + JSON.stringify(errMess, null, 4));
				});
			}
		};

		/**
		 * init load of config files
		 */
		$scope.loadDefaultConfig = function () {
			viewState.somethingInProgress = true;
			viewState.somethingInProgressTxt = 'Loading schema files';
			// load schemas first
			Validationservice.loadSchemas().then(function (replies) {
				Validationservice.setSchemas(replies);
				Iohandlerservice.httpGetDefaultDesign().then(function onSuccess (response) {
					ConfigProviderService.setDesign(response.data);
					Iohandlerservice.httpGetDefaultConfig().then(function onSuccess (response) {
						viewState.somethingInProgressTxt = 'Validating emuwebappConfig';
						var validRes = Validationservice.validateJSO('emuwebappConfigSchema', response.data);
						if (validRes === true) {
							ConfigProviderService.setVals(response.data);
							angular.copy($scope.cps.vals ,$scope.cps.initDbConfig);
							$scope.handleDefaultConfigLoaded();
							// loadFilesForEmbeddedApp if these are set
							$scope.loadFilesForEmbeddedApp();
							$scope.checkIfToShowWelcomeModal();
							// FOR DEVELOPMENT
							//$scope.aboutBtnClick();
							viewState.somethingInProgress = false;
						} else {
							modalService.open('views/error.html', 'Error validating / checking emuwebappConfigSchema: ' + JSON.stringify(validRes, null, 4)).then(function () {
								appStateService.resetToInitState();
							});
						}

					}, function onError (response) {
						modalService.open('views/error.html', 'Could not get defaultConfig for EMU-webApp: ' + ' status: ' + response.status + ' headers: ' + response.headers + ' config ' + response.config).then(function () {
							appStateService.resetToInitState();
						});
					});
				}, function onError (response) {
					modalService.open('views/error.html', 'Could not get defaultConfig for EMU-webApp: ' + ' status: ' + response.status + ' headers: ' + response.headers + ' config ' + response.config).then(function () {
						appStateService.resetToInitState();
					});
				});
			}, function (errMess) {
				modalService.open('views/error.html', 'Error loading schema file: ' + JSON.stringify(errMess, null, 4)).then(function () {
					appStateService.resetToInitState();
				});
			});
		};

		// call function on init
		$scope.loadDefaultConfig();

		$scope.checkIfToShowWelcomeModal = function () {
			var curVal = localStorage.getItem('haveShownWelcomeModal');
			if (!browserDetector.isBrowser.PhantomJS() && curVal === null) {
				localStorage.setItem('haveShownWelcomeModal', 'true');
				$scope.internalVars.showAboutHint = true;
			}

			// FOR DEVELOPMENT
			//$scope.internalVars.showAboutHint = true;
		};

		$scope.getCurBndlName = function () {
			return loadedMetaDataService.getCurBndlName();
		};

		/**
		 * function called after default config was loaded
		 */
		$scope.handleDefaultConfigLoaded = function () {

			if (!viewState.getsubmenuOpen()) {
				viewState.toggleSubmenu(ConfigProviderService.design.animation.period);
			}
			// check if either autoConnect is set in DBconfig or as get parameter
			var searchObject = $location.search();

			if (ConfigProviderService.vals.main.autoConnect || searchObject.autoConnect === 'true') {
				if (typeof searchObject.serverUrl !== 'undefined') { // overwrite serverUrl if set as GET parameter
					ConfigProviderService.vals.main.serverUrl = searchObject.serverUrl;
				}
				Iohandlerservice.wsH.initConnect(ConfigProviderService.vals.main.serverUrl).then(function (message) {
					if (message.type === 'error') {
						modalService.open('views/error.html', 'Could not connect to websocket server: ' + ConfigProviderService.vals.main.serverUrl).then(function () {
						appStateService.resetToInitState();
					});
					} else {
						$scope.handleConnectedToWSserver({session: null, reload: null});
					}
				}, function (errMess) {
					modalService.open('views/error.html', 'Could not connect to websocket server: ' + JSON.stringify(errMess, null, 4)).then(function () {
						appStateService.resetToInitState();
					});
				});
			}

			// init loading of files for testing
			viewState.setspectroSettings(ConfigProviderService.vals.spectrogramSettings.windowSizeInSecs,
				ConfigProviderService.vals.spectrogramSettings.rangeFrom,
				ConfigProviderService.vals.spectrogramSettings.rangeTo,
				ConfigProviderService.vals.spectrogramSettings.dynamicRange,
				ConfigProviderService.vals.spectrogramSettings.window,
				ConfigProviderService.vals.spectrogramSettings.drawHeatMapColors,
				ConfigProviderService.vals.spectrogramSettings.preEmphasisFilterFactor,
				ConfigProviderService.vals.spectrogramSettings.heatMapColorAnchors);

			// setting transition values
			viewState.setTransitionTime(ConfigProviderService.design.animation.period);
		};

		/**
		 * function is called after websocket connection
		 * has been established. It executes the protocol
		 * and loads the first bundle in the bundle list (= default behavior).
		 */
		$scope.handleConnectedToWSserver = function (data) {
			// hide drop zone
			var session = data.session;
			var reload = data.reload;
			viewState.showDropZone = false;
			ConfigProviderService.vals.main.comMode = 'WS';
			ConfigProviderService.vals.activeButtons.openDemoDB = false;
			viewState.somethingInProgress = true;
			viewState.somethingInProgressTxt = 'Checking protocol...';
			// Check if server speaks the same protocol
			Iohandlerservice.getProtocol().then(function (res) {
				if (res.protocol === 'EMU-webApp-websocket-protocol' && res.version === '0.0.2') {
					viewState.somethingInProgressTxt = 'Checking user management...';
					// then ask if server does user management
					Iohandlerservice.getDoUserManagement().then(function (doUsrData) {
						if (doUsrData === 'NO') {
							$scope.innerHandleConnectedToWSserver({session: session, reload: reload});
						} else {
							// show user management error
							modalService.open('views/loginModal.html').then(function (res) {
								if (res) {
									$scope.innerHandleConnectedToWSserver({session: session, reload: reload});
								} else {
									appStateService.resetToInitState();
								}
							});
						}
					});
					
				} else {
					// show protocol error and disconnect from server
					modalService.open('views/error.html', 'Could not connect to websocket server: ' + ConfigProviderService.vals.main.serverUrl + '. It does not speak the same protocol as this client. Its protocol answer was: "' + res.protocol + '" with the version: "' + res.version + '"').then(function () {
						appStateService.resetToInitState();
					});
				}
			});
		};

		/**
		 * to avoid redundant code...
		 */
		$scope.innerHandleConnectedToWSserver = function (data) {
			var session = data.session;
			var reload = data.reload;
			viewState.somethingInProgressTxt = 'Loading DB config...';
			// then get the DBconfigFile
			Iohandlerservice.httpGetDefaultDesign().then(function onSuccess(response) {
				ConfigProviderService.setDesign(response.data);
				Iohandlerservice.getDBconfigFile().then(function (data) {
					// first element of perspectives is default perspective
					viewState.curPerspectiveIdx = 0;
					ConfigProviderService.setVals(data.EMUwebAppConfig);
					// FOR DEVELOPMENT
					//$scope.showEditDBconfigBtnClick();


					var validRes = Validationservice.validateJSO('emuwebappConfigSchema', ConfigProviderService.vals);
					if (validRes === true) {
						ConfigProviderService.curDbConfig = data;
						viewState.setCurLevelAttrDefs(ConfigProviderService.curDbConfig.levelDefinitions);
						validRes = Validationservice.validateJSO('DBconfigFileSchema', data);
						if (validRes === true) {
							// then get the DBconfigFile
							viewState.somethingInProgressTxt = 'Loading bundle list...';
							Iohandlerservice.getBundleList().then(function (bdata) {
								validRes = loadedMetaDataService.setBundleList(bdata);
								// show standard buttons
								ConfigProviderService.vals.activeButtons.clear = true;
								ConfigProviderService.vals.activeButtons.specSettings = true;

								if (validRes === true) {
									// then load first bundle in list
									if(session === null) {
										session = loadedMetaDataService.getBundleList()[0];
									}
									dbObjLoadSaveService.loadBundle(session).then(function (){
										// FOR DEVELOPMENT:
										// sServObj.saveBundle(); // for testing save function
										// $scope.menuBundleSaveBtnClick(); // for testing save button
										// $scope.showHierarchyBtnClick(); // for devel of showHierarchy modal
										// $scope.spectSettingsBtnClick(); // for testing spect settings dial
										// $scope.searchBtnClick();
										// viewState.curViewPort.sS = 27455;
										// viewState.curViewPort.eS = 30180;

									});

									//viewState.currentPage = (viewState.numberOfPages(loadedMetaDataService.getBundleList().length)) - 1;
									if(reload) {
										loadedMetaDataService.openCollapseSession(session.session);
									}
								} else {
									modalService.open('views/error.html', 'Error validating bundleList: ' + JSON.stringify(validRes, null, 4)).then(function () {
										appStateService.resetToInitState();
									});
								}
							});

						} else {
							modalService.open('views/error.html', 'Error validating / checking DBconfig: ' + JSON.stringify(validRes, null, 4)).then(function () {
								appStateService.resetToInitState();
							});
						}

					} else {
						modalService.open('views/error.html', 'Error validating ConfigProviderService.vals (emuwebappConfig data) after applying changes of newly loaded config (most likely due to wrong entry...): ' + JSON.stringify(validRes, null, 4)).then(function () {
							appStateService.resetToInitState();
						});
					}
				});
			});
		};

		/**
		 *
		 */
		$scope.toggleCollapseSession = function (ses) {
			$scope.uniqSessionList[ses].collapsed = !$scope.uniqSessionList[ses].collapsed;
		};

		/**
		 *
		 */
		$scope.getEnlarge = function (index) {
			var len = ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].signalCanvases.order.length;
			var large = 50;
			if (viewState.getenlarge() === -1) {
				return 'auto';
			} else {
				if (len === 1) {
					return 'auto';
				}
				if (len === 2) {
					if (viewState.getenlarge() === index) {
						return '70%';
					} else {
						return '27%';
					}
				} else {
					if (viewState.getenlarge() === index) {
						return large + '%';
					} else {
						return (95 - large) / (len - 1) + '%';
					}
				}
			}
		};


		/**
		 *
		 */
		$scope.cursorInTextField = function () {
			viewState.setcursorInTextField(true);
		};

		/**
		 *
		 */
		$scope.cursorOutOfTextField = function () {
			viewState.setcursorInTextField(false);
		};

		/////////////////////////////////////////
		// handle button clicks

		// top menu:
		/**
		 *
		 */
		$scope.addLevelSegBtnClick = function () {
			if (viewState.getPermission('addLevelSegBtnClick')) {
				var length = 0;
				if (DataService.data.levels !== undefined) {
					length = DataService.data.levels.length;
				}
				var newName = 'levelNr' + length;
				var level = {
					items: [],
					name: newName,
					type: 'SEGMENT'
				};

				if (viewState.getCurAttrDef(newName) === undefined) {
					var leveldef = {
						'name': newName,
						'type': 'EVENT',
						'attributeDefinitions': {
							'name': newName,
							'type': 'string'
						}
					};
					viewState.setCurLevelAttrDefs(leveldef);
				}
				LevelService.insertLevel(level, length, viewState.curPerspectiveIdx);
				//  Add to history
				HistoryService.addObjToUndoStack({
					'type': 'ANNOT',
					'action': 'INSERTLEVEL',
					'level': level,
					'id': length,
					'curPerspectiveIdx': viewState.curPerspectiveIdx
				});
				viewState.selectLevel(false, ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].levelCanvases.order, LevelService); // pass in LevelService to prevent circular deps
			}
		};

		/**
		 *
		 */
		$scope.addLevelPointBtnClick = function () {

			if (viewState.getPermission('addLevelPointBtnClick')) {
				var length = 0;
				if (DataService.data.levels !== undefined) {
					length = DataService.data.levels.length;
				}
				var newName = 'levelNr' + length;
				var level = {
					items: [],
					name: newName,
					type: 'EVENT'
				};
				if (viewState.getCurAttrDef(newName) === undefined) {
					var leveldef = {
						name: newName,
						type: 'EVENT',
						attributeDefinitions: {
							name: newName,
							type: 'string'
						}
					};
					viewState.setCurLevelAttrDefs(leveldef);
				}
				LevelService.insertLevel(level, length, viewState.curPerspectiveIdx);
				//  Add to history
				HistoryService.addObjToUndoStack({
					'type': 'ANNOT',
					'action': 'INSERTLEVEL',
					'level': level,
					'id': length,
					'curPerspectiveIdx': viewState.curPerspectiveIdx
				});
				viewState.selectLevel(false, ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].levelCanvases.order, LevelService); // pass in LevelService to prevent circular deps
			}
		};

		/**
		 *
		 */
		$scope.renameSelLevelBtnClick = function () {
			if (viewState.getPermission('renameSelLevelBtnClick')) {
				if (viewState.getcurClickLevelName() !== undefined) {
					modalService.open('views/renameLevel.html', viewState.getcurClickLevelName());
				} else {
					modalService.open('views/error.html', 'Rename Error : Please choose a Level first !');
				}
			}
		};

		/**
		 *
		 */
		$scope.downloadTextGridBtnClick = function () {
			if (viewState.getPermission('downloadTextGridBtnClick')) {
				Textgridparserservice.asyncToTextGrid().then(function (parseMess) {
					parseMess = parseMess.replace(/\t/g, '    '); // replace all tabs with 4 spaces
					modalService.open('views/export.html', loadedMetaDataService.getCurBndl().name + '.TextGrid', parseMess);
				});
			}
		};

		/**
		 *
		 */
		$scope.downloadAnnotationBtnClick = function () {
			if (viewState.getPermission('downloadAnnotationBtnClick')) {
				if(Validationservice.validateJSO('emuwebappConfigSchema', DataService.getData())) {
					modalService.open('views/export.html', loadedMetaDataService.getCurBndl().name + '_annot.json', angular.toJson(DataService.getData(), true));
				}
			}
		};

		/**
		 *
		 */
		$scope.spectSettingsBtnClick = function () {
			if (viewState.getPermission('spectSettingsChange')) {
				modalService.open('views/spectSettings.html');
			}
		};

		/**
		 *
		 */
		$scope.connectBtnClick = function () {
			if (viewState.getPermission('connectBtnClick')) {
				modalService.open('views/connectModal.html').then(function (url) {
					if (url) {
						viewState.somethingInProgressTxt = 'Connecting to server...';
						viewState.somethingInProgress = true;
						viewState.url = url;
						Iohandlerservice.wsH.initConnect(url).then(function (message) {
							if (message.type === 'error') {
								modalService.open('views/error.html', 'Could not connect to websocket server: ' + url).then(function () {
									appStateService.resetToInitState();
								});
							} else {
								$scope.handleConnectedToWSserver({session: null, reload: null});
							}
						}, function (errMess) {
							modalService.open('views/error.html', 'Could not connect to websocket server: ' + JSON.stringify(errMess, null, 4)).then(function () {
								appStateService.resetToInitState();
							});
						});
					}
				});
			} else {

			}
		};

		/**
		 *
		 */
		$scope.openDemoDBbtnClick = function (nameOfDB) {
			if (viewState.getPermission('openDemoBtnDBclick')) {
				$scope.dropdown = false;
				ConfigProviderService.vals.activeButtons.openDemoDB = false;
				loadedMetaDataService.setDemoDbName(nameOfDB);
				// hide drop zone
				viewState.showDropZone = false;

				viewState.somethingInProgress = true;
				// alert(nameOfDB);
				viewState.setState('loadingSaving');
				ConfigProviderService.vals.main.comMode = 'DEMO';
				viewState.somethingInProgressTxt = 'Loading DB config...';
				Iohandlerservice.httpGetDefaultDesign().then(function onSuccess(response) {
					ConfigProviderService.setDesign(response.data);
					Iohandlerservice.getDBconfigFile(nameOfDB).then(function (res) {
						var data = res.data;
						// first element of perspectives is default perspective
						viewState.curPerspectiveIdx = 0;
						ConfigProviderService.setVals(data.EMUwebAppConfig);

						var validRes = Validationservice.validateJSO('emuwebappConfigSchema', ConfigProviderService.vals);
						if (validRes === true) {
							ConfigProviderService.curDbConfig = data;
							viewState.setCurLevelAttrDefs(ConfigProviderService.curDbConfig.levelDefinitions);
							validRes = Validationservice.validateJSO('DBconfigFileSchema', ConfigProviderService.curDbConfig);

							if (validRes === true) {
								// then get the DBconfigFile
								viewState.somethingInProgressTxt = 'Loading bundle list...';

								Iohandlerservice.getBundleList(nameOfDB).then(function (res) {
									var bdata = res.data;
									// validRes = Validationservice.validateJSO('bundleListSchema', bdata);
									// if (validRes === true) {
									loadedMetaDataService.setBundleList(bdata);
									// show standard buttons
									ConfigProviderService.vals.activeButtons.clear = true;
									ConfigProviderService.vals.activeButtons.specSettings = true;

									// then load first bundle in list
									dbObjLoadSaveService.loadBundle(loadedMetaDataService.getBundleList()[0]);

								}, function (err) {
									modalService.open('views/error.html', 'Error loading bundle list of ' + nameOfDB + ': ' + err.data + ' STATUS: ' + err.status).then(function () {
										appStateService.resetToInitState();
									});
								});
							} else {
								modalService.open('views/error.html', 'Error validating / checking DBconfig: ' + JSON.stringify(validRes, null, 4)).then(function () {
									appStateService.resetToInitState();
								});
							}


						} else {
							modalService.open('views/error.html', 'Error validating ConfigProviderService.vals (emuwebappConfig data) after applying changes of newly loaded config (most likely due to wrong entry...): ' + JSON.stringify(validRes, null, 4)).then(function () {
								appStateService.resetToInitState();
							});
						}

					}, function (err) {
						modalService.open('views/error.html', 'Error loading DB config of ' + nameOfDB + ': ' + err.data + ' STATUS: ' + err.status).then(function () {
							appStateService.resetToInitState();
						});
					});
				});
			}
		};

		/**
		 *
		 */
		$scope.aboutBtnClick = function () {
			if (viewState.getPermission('aboutBtnClick')) {
				modalService.open('views/help.html');
			}
		};

		/**
		 *
		 */
		$scope.showHierarchyBtnClick = function () {
			if (!viewState.hierarchyState.isShown()) {
				viewState.hierarchyState.toggleHierarchy();
				modalService.open('views/showHierarchyModal.html');
			}
		};

		/**
		 *
		 */
		$scope.showEditDBconfigBtnClick = function () {
			modalService.open('views/tabbed.html').then(function (res) {
				if (res === false) {
					// do nothing when user clicks on cancle
				}
				else {
					if (Validationservice.validateJSO('emuwebappConfigSchema', res)) {
						$scope.cps.getDelta(res).then(function (delta) {
							Iohandlerservice.saveConfiguration(angular.toJson(delta, true)).then(function () {
								if ((HistoryService.movesAwayFromLastSave !== 0 && ConfigProviderService.vals.main.comMode !== 'DEMO')) {
									modalService.open('views/confirmModal.html', 'Do you wish to clear all loaded data and if connected disconnect from the server? CAUTION: YOU HAVE UNSAVED CHANGES! These will be lost if you confirm.').then(function (res) {
										if (res) {
											appStateService.reloadToInitState();
										}
									});
								}
								else {
									appStateService.reloadToInitState($scope.lmds.getCurBndl());
								}
							});				
						});
					}
					else {
						modalService.open('views/error.html', 'Sorry, there were errors in your configuration.');
					}
				}
			});
		};


		/**
		 *
		 */
		$scope.searchBtnClick = function () {
			if (viewState.getPermission('searchBtnClick')) {
				modalService.open('views/searchAnnot.html');
			}
		};


		/**
		 *
		 */
		$scope.clearBtnClick = function () {
			// viewState.setdragBarActive(false);
			var modalText;
			if ((HistoryService.movesAwayFromLastSave !== 0 && ConfigProviderService.vals.main.comMode !== 'DEMO')) {
				modalText = 'Do you wish to clear all loaded data and if connected disconnect from the server? CAUTION: YOU HAVE UNSAVED CHANGES! These will be lost if you confirm.';
			} else {
				modalText = 'Do you wish to clear all loaded data and if connected disconnect from the server? You have NO unsaved changes so no changes will be lost.';
			}
			modalService.open('views/confirmModal.html', modalText).then(function (res) {
				if (res) {
					appStateService.resetToInitState();
				}
			});
		};

		// bottom menu:

		/**
		 *
		 */
		$scope.cmdZoomAll = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.setViewPort(0, Soundhandlerservice.audioBuffer.length);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdZoomIn = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.zoomViewPort(true);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdZoomOut = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.zoomViewPort(false);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdZoomLeft = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.shiftViewPort(false);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdZoomRight = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.shiftViewPort(true);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdZoomSel = function () {
			if (viewState.getPermission('zoom')) {
				LevelService.deleteEditArea();
				viewState.setViewPort(viewState.curViewPort.selectS, viewState.curViewPort.selectE);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdPlayView = function () {
			if (viewState.getPermission('playaudio')) {
				Soundhandlerservice.playFromTo(viewState.curViewPort.sS, viewState.curViewPort.eS);
				viewState.animatePlayHead(viewState.curViewPort.sS, viewState.curViewPort.eS);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdPlaySel = function () {
			if (viewState.getPermission('playaudio')) {
				Soundhandlerservice.playFromTo(viewState.curViewPort.selectS, viewState.curViewPort.selectE);
				viewState.animatePlayHead(viewState.curViewPort.selectS, viewState.curViewPort.selectE);
			} else {
				//console.log('action currently not allowed');
			}
		};

		/**
		 *
		 */
		$scope.cmdPlayAll = function () {
			if (viewState.getPermission('playaudio')) {
				Soundhandlerservice.playFromTo(0, Soundhandlerservice.audioBuffer.length);
				viewState.animatePlayHead(0, Soundhandlerservice.audioBuffer.length);
			} else {
				//console.log('action currently not allowed');
			}
		};

		///////////////////////////
		// other

		/**
		 * function used to change perspective
		 * @param persp json object of current perspective containing name attribute
		 */
		$scope.changePerspective = function (persp) {

			var newIdx;
			for (var i = 0; i < ConfigProviderService.vals.perspectives.length; i++) {
				if (persp.name === ConfigProviderService.vals.perspectives[i].name) {
					newIdx = i;
				}
			}
			viewState.switchPerspective(newIdx, ConfigProviderService.vals.perspectives);
			// close submenu
			viewState.setRightsubmenuOpen(!viewState.getRightsubmenuOpen());
		};

		/**
		 * function used by right side menu to get color of current perspecitve in ul
		 * @param persp json object of current perspective containing name attribute
		 */
		$scope.getPerspectiveColor = function (persp) {
			var cl;
			if (viewState.curPerspectiveIdx === -1 || persp.name === ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].name) {
				cl = 'emuwebapp-curSelPerspLi';
			} else {
				cl = 'emuwebapp-perspLi';
			}
			return cl;
		};

	});
