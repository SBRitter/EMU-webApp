'use strict';

/**
 * @ngdoc service
 * @name emuwebApp.dbObjLoadSaveService
 * @description
 * # dbObjLoadSaveService
 * Service in the emuwebApp.
 */
angular.module('emuwebApp')
	.service('dbObjLoadSaveService', function dbObjLoadSaveService($log, $q, DataService, viewState, HistoryService, loadedMetaDataService, Ssffdataservice, Iohandlerservice, Binarydatamaniphelper, Wavparserservice, Soundhandlerservice, Ssffparserservice, Validationservice, LevelService, modalService, ConfigProviderService, appStateService, StandardFuncsService) {
		// shared service object
		var sServObj = {};

		/**
		 * general loadBundle method.
		 * @param bndl object containing name attribute of currently loaded bundle
		 */
		sServObj.loadBundle = function (bndl) {
			var defer = $q.defer();
			// check if bndl has to be saved
			viewState.setcurClickItem(null);
			if ((HistoryService.movesAwayFromLastSave !== 0 && ConfigProviderService.vals.main.comMode !== 'DEMO' && ConfigProviderService.vals.activeButtons.saveBundle)) {
				var curBndl = loadedMetaDataService.getCurBndl();
				if (bndl !== curBndl) {
					// $scope.lastclickedutt = bndl;
					modalService.open('views/saveChanges.html', curBndl.session + ':' + curBndl.name).then(function (messModal) {
						if (messModal === 'saveChanges') {
							// save current bundle
							sServObj.saveBundle().then(function () {
								// load new bundle
								sServObj.loadBundle(bndl);
							});
						} else if (messModal === 'discardChanges') {
							// reset history
							HistoryService.resetToInitState();
							// load new bundle
							sServObj.loadBundle(bndl);
						}
					});
				}
			} else {
				if (bndl !== loadedMetaDataService.getCurBndl()) {
					// reset history
					HistoryService.resetToInitState();
					// reset hierarchy
					viewState.hierarchyState.reset();
					// set state
					LevelService.deleteEditArea();
					viewState.setEditing(false);
					viewState.setState('loadingSaving');

					viewState.somethingInProgress = true;
					viewState.somethingInProgressTxt = 'Loading bundle: ' + bndl.name;
					// empty ssff files
					Ssffdataservice.data = [];
					Iohandlerservice.getBundle(bndl.name, bndl.session, loadedMetaDataService.getDemoDbName()).then(function (bundleData) {
						// check if response from http request
						if (bundleData.status === 200) {
							bundleData = bundleData.data;
						}

						// validate bundle
						var validRes = Validationservice.validateJSO('bundleSchema', bundleData);

						if (validRes === true) {

							var arrBuff;
							// set wav file
							if(bundleData.mediaFile.encoding === 'BASE64'){
								arrBuff = Binarydatamaniphelper.base64ToArrayBuffer(bundleData.mediaFile.data);
                                innerLoadBundle(bndl, bundleData, arrBuff, defer);
                            }else if(bundleData.mediaFile.encoding === 'GETURL'){
                                Iohandlerservice.httpGetPath(bundleData.mediaFile.data, 'arraybuffer').then(function (res) {
                                    innerLoadBundle(bndl, bundleData, res.data, defer);
                                });
							}
						} else {
							modalService.open('views/error.html', 'Error validating annotation file: ' + JSON.stringify(validRes, null, 4)).then(function () {
								appStateService.resetToInitState();
							});
						}


					}, function (errMess) {
						// check for http vs websocket response
						if (errMess.data) {
							modalService.open('views/error.html', 'Error loading bundle: ' + errMess.data).then(function () {
								appStateService.resetToInitState();
							});
						} else {
							modalService.open('views/error.html', 'Error loading bundle: ' + errMess.status.message).then(function () {
								appStateService.resetToInitState();
							});
						}
					});
				}
			}
			return defer.promise; 
		};

        function innerLoadBundle(bndl, bundleData, arrBuff, defer) {
            viewState.somethingInProgressTxt = 'Parsing WAV file...';

            Wavparserservice.parseWavAudioBuf(arrBuff).then(function (messWavParser) {
                var audioBuffer = messWavParser;
                viewState.curViewPort.sS = 0;
                viewState.curViewPort.eS = audioBuffer.length;
                if(bndl.timeAnchors !== undefined && bndl.timeAnchors.length > 0){
                    viewState.curViewPort.selectS = bndl.timeAnchors[0].sample_start;
                    viewState.curViewPort.selectE = bndl.timeAnchors[0].sample_end;
                }else {
                    viewState.resetSelect();
                }
                viewState.curTimeAnchorIdx = -1;
                viewState.curClickSegments = [];
                viewState.curClickLevelName = undefined;
                viewState.curClickLevelType = undefined;

                Soundhandlerservice.audioBuffer = audioBuffer;

                // set all ssff files
                viewState.somethingInProgressTxt = 'Parsing SSFF files...';
                Ssffparserservice.asyncParseSsffArr(bundleData.ssffFiles).then(function (ssffJso) {
                    Ssffdataservice.data = ssffJso.data;
                    // set annotation
                    DataService.setData(bundleData.annotation);
                    loadedMetaDataService.setCurBndl(bndl);
                    // select first level
                    viewState.selectLevel(false, ConfigProviderService.vals.perspectives[viewState.curPerspectiveIdx].levelCanvases.order, LevelService);
                    viewState.setState('labeling');

                    viewState.somethingInProgress = false;
                    viewState.somethingInProgressTxt = 'Done!';
                    defer.resolve();
                }, function (errMess) {
                    modalService.open('views/error.html', 'Error parsing SSFF file: ' + errMess.status.message).then(function () {
                        appStateService.resetToInitState();
                    });
                });
            }, function (errMess) {
                modalService.open('views/error.html', 'Error parsing wav file: ' + errMess.status.message).then(function () {
                    appStateService.resetToInitState();
                });
            });
        }

        /**
		 * general purpose save bundle function.
		 * @return promise that is resolved after completion (rejected on error)
		 */
		sServObj.saveBundle = function () {
			// check if something has changed
			// if (HistoryService.movesAwayFromLastSave !== 0) {
			if (viewState.getPermission('saveBndlBtnClick')) {
				var defer = $q.defer();
				viewState.somethingInProgress = true;
				viewState.setState('loadingSaving');
				//create bundle json
				var bundleData = {};
				viewState.somethingInProgressTxt = 'Creating bundle json...';
				bundleData.ssffFiles = [];
				// ssffFiles (only FORMANTS are allowed to be manipulated so only this track is sent back to server)
				var formants = Ssffdataservice.getFile('FORMANTS');

				if (formants !== undefined) {
					Ssffparserservice.asyncJso2ssff(formants).then(function (messParser) {
						bundleData.ssffFiles.push({
							'fileExtension': formants.fileExtension,
							'encoding': 'BASE64',
							'data': Binarydatamaniphelper.arrayBufferToBase64(messParser.data)
						});
						sServObj.getAnnotationAndSaveBndl(bundleData, defer);

					}, function (errMess) {
						modalService.open('views/error.html', 'Error converting javascript object to SSFF file: ' + errMess.status.message);
						defer.reject();
					});
				} else {
					sServObj.getAnnotationAndSaveBndl(bundleData, defer);
				}

				return defer.promise;
				// }
			} else {
				$log.info('Action: menuBundleSaveBtnClick not allowed!');
			}

		};


		/**
		 *
		 */
		sServObj.getAnnotationAndSaveBndl = function (bundleData, defer) {

			// Validate annotation before saving
			viewState.somethingInProgressTxt = 'Validating annotJSON ...';

			var validRes = Validationservice.validateJSO('annotationFileSchema', DataService.getData());
			if (validRes !== true) {
				$log.warn ('PROBLEM: trying to save bundle but bundle is invalid. traverseAndClean() will be called.');
				$log.error (validRes);
			}

			// clean annot data just to be safe...
			StandardFuncsService.traverseAndClean(DataService.getData());

			////////////////////////////
			// construct bundle

			// annotation
			bundleData.annotation = DataService.getData();

			// empty media file (depricated since schema was updated)
			bundleData.mediaFile = {'encoding': 'BASE64', 'data': ''};

			var curBndl = loadedMetaDataService.getCurBndl();

			// add session if available
			if (typeof curBndl.session !== 'undefined') {
				bundleData.session = curBndl.session;
			}
			// add finishedEditing if available
			if (typeof curBndl.finishedEditing !== 'undefined') {
				bundleData.finishedEditing = curBndl.finishedEditing;
			}
			// add comment if available
			if (typeof curBndl.comment !== 'undefined') {
				bundleData.comment = curBndl.comment;
			}

			// validate bundle
			viewState.somethingInProgressTxt = 'Validating bundle ...';
			validRes = Validationservice.validateJSO('bundleSchema', bundleData);

			if (validRes !== true) {
				$log.error('GRAVE PROBLEM: trying to save bundle but bundle is invalid. traverseAndClean() HAS ALREADY BEEN CALLED.');
				$log.error(validRes);

				modalService.open('views/error.html', 'Somehow the data for this bundle has been corrupted. This is most likely a nasty and diffucult to spot bug. If you are at the IPS right now, please contact an EMU developer immediately. The Validation error is: ' + JSON.stringify(validRes, null, 4)).then(function () {
					viewState.somethingInProgressTxt = '';
					viewState.somethingInProgress = false;
					viewState.setState('labeling');
					defer.reject();
				});
			} else {
				viewState.somethingInProgressTxt = 'Saving bundle...';
				Iohandlerservice.saveBundle(bundleData).then(function () {
					viewState.somethingInProgressTxt = 'Done!';
					viewState.somethingInProgress = false;
					HistoryService.movesAwayFromLastSave = 0;
					defer.resolve();
					viewState.setState('labeling');
				}, function (errMess) {
					modalService.open('views/error.html', 'Error saving bundle: ' + errMess.status.message).then(function () {
						appStateService.resetToInitState();
					});
					defer.reject();
				});
			}
		};
		return (sServObj);
	});
