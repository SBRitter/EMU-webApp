'use strict';

angular.module('emulvcApp')
	.service('Tierservice', function Tierservice($rootScope) {
		// shared service object
		var sServObj = {};

		sServObj.data = {};

		sServObj.getData = function () {
			return sServObj.data;
		};

		sServObj.setData = function (data) {
			angular.copy(data, sServObj.data);
		};

    /**
     * gets the current (mousemove) Tier Name
     */
    sServObj.getcurMouseTierDetails = function (tierName) {
      var curTier;
      sServObj.data.tiers.forEach(function (t) {
        if (t.TierName === tierName) {
          curTier = t;
        }
      });
      return curTier;

    };

    /**
     * gets tier details by passing in tierName
     */
    sServObj.getTierDetails = function (tierName) {
      var curTier = null;
      var y = null;
      sServObj.data.tiers.forEach(function (t, x) {
        if (t.TierName === tierName) {
          curTier = t;
          y = x;
        }
      });
      return {tier: curTier, id: y};
    };	
    
    sServObj.deleteTier = function (tierName, id) { 
        var y = 0; 
        var curTier;
		angular.forEach(sServObj.data.tiers, function (t, x) {
			if (t.TierName === tierName && id == x) {
			    curTier = t;
			    y = x;
				sServObj.data.tiers.splice(x, 1);
			}
		});	
		return {tier: curTier, id: y, name: tierName};
    };
        
    /**
     * rename the label of a tier by passing in tiername and id
     */    
    sServObj.renameLabel = function (tiername, id, newLabelName) {
	  angular.forEach(sServObj.data.tiers, function (t) {
	    if (t.TierName === tiername) {
		  angular.forEach(t.events, function (evt, i) {
		    if (id == i) {
			  evt.label = newLabelName;
		    }
	      });
	    }
	  });
	};	
	    
    /**
     * rename the label of a tier by passing in tiername and id
     */    
    sServObj.renameTier = function (oldname, newname) {
	  angular.forEach(sServObj.data.tiers, function (t, i) {
	    if (t.TierName === oldname) {
			t.TierName = newname;
	    }
	  });
	};	
	
    /**
     * traverse through tiers an return next/prev event and id
     */	
	sServObj.tabNext = function (invers, now, tN) {
	    var ret = new Object();
		angular.forEach(sServObj.data.tiers, function (t) {
			var i = 0;
			if (t.TierName === tN) {
				angular.forEach(t.events, function (evt) {
					if (i === now) {
					    ret.event = evt;
					    ret.id =now;
					}
					++i;
				});
			}
		});
		return ret;
	};
	
	sServObj.deleteSegments = function (toDelete, tierName) {
	    var ret = new Object();
		angular.forEach(sServObj.data.tiers, function (t) {
			if (t.TierName === tierName) {
				if (t.type === "seg") {
					for (var x in toDelete) {
						var id = toDelete[x];
						if (id > 0) {
							var length = t.events[id].sampleDur;
							t.events[id - 1].sampleDur += length / 2;
							t.events[id + 1].sampleDur += length / 2;
							t.events[id + 1].startSample -= length / 2;
							t.events.splice(id, 1);
						}
					}
				}
				if (toDelete[0] - 1 > 0) {
				    ret.val1 = t.events[toDelete[0] - 1];
				    ret.val2 = toDelete[0] - 1;
				} else {
				    ret.val1 = t.events[0];
				    ret.val2 = 0;
				}
				return ret;
			}
		});
	};	
	
	sServObj.deleteBoundary = function (toDelete, tierName, tierType) {
		angular.forEach(sServObj.data.tiers, function (t) {
			if (t.TierName === tierName) {
				angular.forEach(t.events, function (evt, id) {
					if (evt.startSample == toDelete.startSample) {
						if (t.type === "point") {
							t.events.splice(id, 1);
						} else {
							t.events[id - 1].label += t.events[id].label;
							t.events[id - 1].sampleDur += t.events[id].sampleDur;
							t.events.splice(id, 1);
						}
					}
				});
			}
		});
	};
	
	
	sServObj.snapBoundary = function (toTop, preSelSS, td) {
		var neighTd;
		var neighTdIdx;
		sServObj.data.tiers.forEach(function (t, tIdx) {
			if (t.TierName === td.TierName) {
				if (tIdx >= 1 && toTop) {
					neighTd = sServObj.data.tiers[tIdx - 1];
					neighTdIdx = tIdx - 1;
				} else if (tIdx < sServObj.data.tiers.length - 1 && !toTop) {
					neighTd = sServObj.data.tiers[tIdx + 1];
					neighTdIdx = tIdx + 1;
				}
			}
		});
		var absMinDist = Infinity;
		var absDist;
		var minDist;
		if (neighTd !== undefined) {
			neighTd.events.forEach(function (itm) {
				absDist = Math.abs(preSelSS - itm.startSample);
				if (absDist < absMinDist) {
					absMinDist = absDist;
					minDist = itm.startSample - preSelSS;
				}
			});
			//this.moveBorder(minDist, td);
		}
	};	
	
	sServObj.moveBoundry = function (changeTime, t, seg) {
		if (null !== t) { // && t.TierName === viewState.getcurMouseTierName()
			if (t.type === 'seg') {
				if (seg > 1 && (t.events[seg - 1].sampleDur + changeTime) >= 1 && (t.events[seg].sampleDur - changeTime) >= 1) {
					t.events[seg - 1].sampleDur += changeTime;
					t.events[seg].startSample += changeTime;
					t.events[seg].sampleDur -= changeTime;
				}
			} else {
				if (seg > 0 && seg < t.events.length - 1) {
					if (t.events[seg].startSample + changeTime >= t.events[seg - 1].startSample &&
						t.events[seg].startSample + changeTime <= t.events[seg + 1].startSample)
						t.events[seg].startSample += changeTime;
				} else if (seg == 0) {
					if (t.events[seg].startSample + changeTime >= 0 &&
						t.events[seg].startSample + changeTime <= t.events[seg + 1].startSample)
						t.events[seg].startSample += changeTime;
				} else if (seg == t.events.length - 1) {
					if (t.events[seg].startSample + changeTime >= t.events[seg - 1].startSample &&
						t.events[seg].startSample + changeTime <= $scope.vs.curViewPort.bufferLength)
						t.events[seg].startSample += changeTime;
				}
			}
		}
	};	
	
	
	sServObj.moveSegment = function (changeTime, t, selected) {
		if (null !== t) { 
			if ((t.events[selected[0] - 1].sampleDur + changeTime) >= 1 && (t.events[selected[selected.length - 1] + 1].sampleDur - changeTime) >= 1) {
				t.events[selected[0] - 1].sampleDur += changeTime;
				for (var i = 0; i < selected.length; i++) {
					t.events[selected[i]].startSample += changeTime;
				}
				t.events[selected[selected.length - 1] + 1].startSample += changeTime;
				t.events[selected[selected.length - 1] + 1].sampleDur -= changeTime;
			}
		}
	};	
	
	sServObj.expandSegment = function (expand, rightSide, selected, tN, changeTime) {
		var startTime = 0;
		var i;
		if (!expand) {
			changeTime = 0 - changeTime;
		}
		if (rightSide) {
	    	angular.forEach(sServObj.data.tiers, function (t) {
		  		if (t.TierName === tN) {
					if (t.events[selected[selected.length - 1] + 1].sampleDur > (selected.length * changeTime)) {
						if (t.events[selected[0]].sampleDur > -(selected.length * changeTime)) {
							var found = false;
							for (i = 1; i <= selected.length; i++) {
								if (t.events[selected[i - 1]].sampleDur + changeTime <= 0) {
									found = true;
								}
							}
							if (found) {
								$rootScope.$broadcast('errorMessage','Expand Segements Error: Cannot Expand/Shrink. Segment would be too small');

							} else {
								for (i = 1; i <= selected.length; i++) {
									t.events[selected[i - 1]].startSample += startTime;
									t.events[selected[i - 1]].sampleDur += changeTime;
									startTime = i * changeTime;
								}
								t.events[selected[selected.length - 1] + 1].startSample += startTime;
								t.events[selected[selected.length - 1] + 1].sampleDur -= startTime;
							}
				  		} else {
							$rootScope.$broadcast('errorMessage','Expand Segements Error: No Space left to decrease');
						
				  		}
					} else {
				  		$rootScope.$broadcast('errorMessage', 'Expand Segements Error: No Space left to increase');
					}
				}
			});
		} else {
	 		angular.forEach(sServObj.data.tiers, function (t) {
				if (t.TierName === tN) {
					if (t.events[selected[0] - 1].sampleDur > (selected.length * changeTime)) {
						if (t.events[selected[selected.length - 1]].sampleDur > (selected.length * changeTime)) {
							var found = false;
							for (i = 1; i <= selected.length; i++) {
								if (t.events[selected[i - 1]].sampleDur + changeTime <= 0) {
									found = true;
								}
							}
							if (found) {
								$rootScope.$broadcast('errorMessage', 'Expand Segements Error : Cannot Expand/Shrink. Segment would be too small');
							} 
							else {
								for (i = 0; i < selected.length; i++) {
									t.events[selected[i]].startSample -= (changeTime * (selected.length - i));
									t.events[selected[i]].sampleDur += changeTime;
								}
								t.events[selected[0] - 1].sampleDur -= changeTime * selected.length;
							}
						} 
						else {
							$rootScope.$broadcast('errorMessage', 'Expand Segements Error : No Space left to increase');
						}
					} 
					else {
						$rootScope.$broadcast('errorMessage','Expand Segements Error : No Space left to decrease');
					}
				}
			});
		}
	};
	
	
	
	
	
		
		
	return sServObj;

});