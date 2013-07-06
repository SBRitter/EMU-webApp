/**
Main Object of emuLVC
it acts as the controller of the web app
and primarily delegates methods to the drawer and
several other components 
*/

var EmuLabeller = {

    /**
    init function has to be called on object 
    to instantiate all its needed objects
    @param params is a 
    */
    
    init: function (params) {
        var my = this;
        
        // define external Application mode Server or Standalone
        my.USAGEMODE = {
            
            // show server menu, load external ressources
            SERVER : {value: 0, name: "Server"},
            
            // show file menu, load local ressources
            STANDALONE : {value: 1, name: "Standalone"},
            
            // alert an error if not configures in main.js
            NOT_CONFIGURED : {value: 2, name: "NotConfigured"}            
        };
        
        // define internal Applications Modes that may not interfere
        my.EDITMODE = {
            // EDITMODE at the beginning
            STANDARD : {value: 0, name: "StandardMode"},           // standard key bindings form main.js
            
            // EDITMODE when editing tiers
            LABEL_RENAME: {value: 1, name: "LabelRenameMode"},       // no keybindings exept enter -> save
            
            // when draging in the timeline (wave & spectro)
            DRAGING_TIMELINE: {value: 2, name: "DragingTimelineMode"},     
            
            // when draging in a tier / multiple tiers
            DRAGING_TIERS: {value: 3, name: "DragingTierMode"},     
            
            // when draging in the minimap
            DRAGING_MINIMAP: {value: 4, name: "DragingMinimapMode"},  

            // when draging the timeline resize bar
            DRAGING_BAR: {value: 5, name: "DragingBarMode"}        
        };
        
        // set internal & external Modes
        
        // internal standard at the beginning
        this.internalMode = my.EDITMODE.STANDARD;
        
        // default is not configured
        this.externalMode = my.USAGEMODE.NOT_CONFIGURED;
        
        // if parameter in main.js is set to server
        if (params.mode=="server") {
            this.externalMode = my.USAGEMODE.SERVER;
        }
            					
        // if parameter in main.js is set to standalone           					
        if (params.mode=="standalone") {
            this.externalMode = my.USAGEMODE.STANDALONE;
        }
            
        // Object Classes
        
        // Backed
        this.backend = Object.create(EmuLabeller.WebAudio);
        this.backend.init(params);
        
        // Drawer
        this.drawer = Object.create(EmuLabeller.Drawer);
        this.drawer.init(params);
        
        // Viewport
        this.viewPort = Object.create(EmuLabeller.ViewPort);
        
        // Parser
        this.labParser = Object.create(EmuLabeller.LabFileParser);
        this.tgParser = Object.create(EmuLabeller.TextGridParser);
        
        // Spectrogram
        this.spectogramDrawer = Object.create(EmuLabeller.spectogramDrawer);
        this.spectogramDrawer.init({specCanvas: params.specCanvas, drawer:this.drawer});
        
        // ssff Parser
        this.ssffParser = Object.create(EmuLabeller.SSFFparser);
        this.ssffParser.init();
        
        // json validator
        this.JSONval = Object.create(EmuLabeller.JSONvalidator);
        this.JSONval.init();
        
        // socket class
        this.socketIOhandler = Object.create(EmuLabeller.socketIOhandler);
        this.socketIOhandler.init();

        // set main.js parameters
        this.fileSelect = params.fileSelect;
        this.menuLeft = params.menuLeft;
        this.menuMain = params.menuMain;
        this.draggableBar = params.draggableBar;
        this.timeline = params.timeline;
        this.tiers = params.tiers;
        this.internalCanvasWidth = params.internalCanvasWidth;
        this.internalCanvasHeightSmall = params.internalCanvasHeightSmall;
        this.internalCanvasHeightBig = params.internalCanvasHeightBig;
        this.tierInfos = params.tierInfos;

        // other used variables
        this.ssffInfos = {data: [], canvases: []};
        this.subMenuOpen = false;
        this.isModalShowing = false;
        this.dragingStart = 0;
        this.resizeTierStart = 0;
        this.relativeY = 0;
        this.newFileType = -1; // 0 = wav, 1 = lab, 2 = F0
        this.playMode = "vP"; // can be "vP", "sel" or "all"
        this.clickedOn = 0;
        this.tierCounter = 0;

        // Initial Usage Mode Configuration
        
        switch(this.externalMode) {
        	case this.USAGEMODE.STANDALONE:
        		this.showLeftPush.style.display = "none";
        		break;
        	case this.USAGEMODE.SERVER:
        		this.fileSelect.style.display = "none";
        		break;
        	default:
        	    alert("Please specify Usage mode 'server' or 'standalone' in main.js !");
        		this.fileSelect.style.display = "none";
        		this.showLeftPush.style.display = "none";
        		break;        	        	
        }
        
        // Initial Bindings
        
        /* right mouse button in whole document
        $(document).bind("contextmenu",function(e){
            if(my.viewPort.selTier!=-1    //multiple select if ANY lable is selected
                     ) { //  and other lable on same tier is selected
                console.log(e);
            }
            else { // any other -> open submenu
                if(my.usageMode==my.MODE.STANDALONE)
                    $('#fileGetterBtn').click();
                if(my.usageMode==my.MODE.SERVER)
                    my.openSubmenu();
            }
            return false;
        });*/
        
        this.backend.bindUpdate(function () {
            if (!my.backend.isPaused()) my.onAudioProcess();
        });

        // All left Mouse Click Functions  
        document.addEventListener('mousedown', function(e){
            my.clickedOn = my.getElement(e).id;
            switch(my.clickedOn) {
                case params.showLeftPush.id:
                    my.openSubmenu();
                break;
                
                case "cmd_addTierSeg":
                    my.addTier();
                break;
                                
                case "cmd_addTierPoint":
                    my.addTier(true);
                break;
                                
                case "cmd_removeTier":
                case "cmd_showHideTier":
                    my.showHideTierDial();
                break;
                                
                case "cmd_download":
                    my.prepDownload();
                break;
                                
                case "cmd_download":
                    my.prepDownload();
                break;
                
                
                
                    
                case params.canvas.id:
                case params.specCanvas.id:
                    my.internalMode = my.EDITMODE.DRAGING_TIMELINE;
                    my.viewPort.selectS = my.viewPort.sS+(my.viewPort.eS-my.viewPort.sS)*my.getX(e);
                    my.viewPort.selectE = my.viewPort.selectS;
                    my.drawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length,my.ssffInfos);
                    my.spectogramDrawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length,my.ssffInfos);
                break;
                    
                case params.draggableBar.id:
                    my.internalMode = my.EDITMODE.DRAGING_BAR;
                    my.dragingStartY = event.clientY;
                    my.offsetTimeline = my.timeline.offsetHeight;
                    my.offsetTiers = my.tiers.offsetHeight;
                break;
                
                case params.scrollCanvas.id:
                    my.removeCanvasDoubleClick();
                    my.internalMode = my.EDITMODE.DRAGING_MINIMAP;
                    var bL = my.backend.currentBuffer.length;
                    var posInB = percents*bL;
                    var len = (my.viewPort.eS-my.viewPort.sS);
                    my.setView(posInB-len/2, posInB+len/2);
                break;
            }

        }); 
 
        // All Mouse Up Functions  
        document.addEventListener('mouseup', function(e){
            if(my.internalMode == my.EDITMODE.DRAGING_TIMELINE){
                my.viewPort.selectE = my.viewPort.sS+(my.viewPort.eS-my.viewPort.sS)*my.getX(e);
                my.drawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length,my.ssffInfos);
                my.spectogramDrawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length,my.ssffInfos);
                my.internalMode = my.EDITMODE.STANDARD;
            }
                    
            if(my.internalMode == my.EDITMODE.DRAGING_BAR){
                my.dragingStartY = event.clientY;
                my.offsetTimeline = my.timeline.offsetHeight;
                my.offsetTiers = my.tiers.offsetHeight;
                my.internalMode = my.EDITMODE.STANDARD;
            }
                
            if(my.internalMode == my.EDITMODE.DRAGING_MINIMAP){
                var bL = my.backend.currentBuffer.length;
                var posInB = percents*bL;
                var len = (my.viewPort.eS-my.viewPort.sS);
                my.setView(posInB-len/2, posInB+len/2);
                my.internalMode = my.EDITMODE.STANDARD;
            }
            
        });  
 
        // All Mouse Click Functions  
        document.addEventListener('mousemove', function(e){
            if(my.internalMode == my.EDITMODE.DRAGING_TIMELINE){
                my.viewPort.selectE = my.viewPort.sS+(my.viewPort.eS-my.viewPort.sS)*my.getX(e);
                my.drawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length);
                my.spectogramDrawer.progress(my.backend.getPlayedPercents(), my.viewPort, my.backend.currentBuffer.length);
            }

            if(my.internalMode == my.EDITMODE.DRAGING_MINIMAP){
                var bL = my.backend.currentBuffer.length;
                var posInB = percents*bL;
                var len = (my.viewPort.eS-my.viewPort.sS);
                my.setView(posInB-len/2, posInB+len/2);
            }
            
            if(my.internalMode == my.EDITMODE.DRAGING_BAR){
                my.diffY = event.clientY - my.dragingStartY; 
                my.timeline.style.height = (my.offsetTimeline+my.diffY)+"px";
                my.tiers.style.top = (my.offsetTimeline+my.diffY-50)+"px";
            }
            
            if(e.shiftKey){
                var curSample = my.viewPort.sS + (my.viewPort.eS-my.viewPort.sS)*my.getX(e);
                my.tierInfos.tiers[my.viewPort.selTier].events[my.viewPort.selBoundaries[0]].time = curSample;
                my.viewPort.selectE = curSample;
                my.drawBuffer();
            }
              
        });  
        
        // All Mouse Up Functions  
        document.addEventListener('contextmenu', function(e){   
            
            alert("hier");
            e.preventDefault();
        
        });   
        
        $(window).resize(function() {
            my.removeCanvasDoubleClick();
        });

    },

    onAudioProcess: function () {
        var percRel = 0;
        var percPlayed = this.backend.getPlayedPercents();
        if (this.playMode == "sel") {
            percRel = this.viewPort.selectE/this.backend.currentBuffer.length;
        }
        if(this.playMode == "vP"){
            if(this.backend.currentBuffer){
                percRel = this.viewPort.eS/this.backend.currentBuffer.length;
            }
        }
        if(this.playMode == "all"){
            percRel = 1.0;
        }

        if (!this.backend.isPaused()) {
            this.drawer.progress(percPlayed, this.viewPort, this.backend.currentBuffer.length);
            this.spectogramDrawer.progress(this.backend.getPlayedPercents(), this.viewPort, this.backend.currentBuffer.length);
        }
        if (percPlayed>percRel) {
            this.drawer.progress(percRel, this.viewPort, this.backend.currentBuffer.length);
            this.spectogramDrawer.progress(this.backend.getPlayedPercents(), this.viewPort, this.backend.currentBuffer.length);
            this.pause();
            // console.log(this);
            // this.playPause();
        }

    },

    /**
    * play audio in certain EDITMODE
    * playMode can be vP, sel, all
    */

    playInMode: function (playMode) {
        var percS, percE;

        if(playMode == "vP" || playMode===null){
            //this.boolPlaySelectedEDITMODE = false;
            this.playMode = "vP";
            //console.log("play vP");
            percS = this.viewPort.sS/this.backend.currentBuffer.length;
            percE = this.viewPort.eS/this.backend.currentBuffer.length;
            this.backend.play(this.backend.getDuration() * percS, this.backend.getDuration() * percE);
        }
        if(playMode == "sel" || playMode===null){
            this.playMode = "sel";
            //this.boolPlaySelectedEDITMODE = true;
            //console.log("play selected");
            percS = this.viewPort.selectS/this.backend.currentBuffer.length;
            percE = this.viewPort.selectE/this.backend.currentBuffer.length;
            this.backend.play(this.backend.getDuration() * percS, this.backend.getDuration() * percE);

        }
        if(playMode == "all" || playMode===null){
            this.playMode = "all";
            //console.log("play all");
            //this.boolPlaySelectedEDITMODE = true;
            this.backend.play(0, this.backend.getDuration());

        }

        //this.backend.play(this.backend.getDuration() * percents);

    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        if (this.backend.paused) {
            //console.log("set to 0");
            this.playInMode("vP");
        } else {
            this.pause();
        }
    },

    drawBuffer: function (isNewlyLoaded) {
        var my = this;
        my.removeCanvasDoubleClick();
        if (this.backend.currentBuffer) {
            this.spectogramDrawer.drawImage(this.backend.currentBuffer,this.viewPort);  
			this.drawer.drawBuffer(this.backend.currentBuffer, this.viewPort, isNewlyLoaded, this.ssffInfos); 
        }
    },

    newlyLoadedBufferReady: function(){
        this.viewPort.init(1, this.backend.currentBuffer.length);
        //console.log(this.backend.currentBuffer.length);
        this.drawBuffer(true);

    },

    /**
     * Loads an audio file via XHR.
     */
     load: function (src) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';

        xhr.addEventListener('load', function (e) {
            my.backend.loadData(
                e.target.response,
                my.newlyLoadedBufferReady.bind(my)
            );//webaudio.js loadData function called
        }, false);
        console.log(src);
        xhr.open('GET', src, true);
        xhr.send();
    },

    setView: function(sSample, eSample){

        var oldStart = this.viewPort.sS;
        var oldEnd = this.viewPort.eS;
        if(sSample){
            this.viewPort.sS = sSample;
        }
        if(eSample){
            this.viewPort.eS = eSample;
        }

        // check if moving left or right is not out of bounds -> prevent zooming on edge when moving left/right
        if (oldStart > this.viewPort.sS && oldEnd > this.viewPort.eS) {
            //moved left
            if(this.viewPort.sS < 1) {
                this.viewPort.sS = 1;
                this.viewPort.eS = oldEnd + Math.abs(this.viewPort.sS)-1;
            }
        }
        if (oldStart < this.viewPort.sS && oldEnd < this.viewPort.eS) {
            //moved right
            if(this.viewPort.eS > this.backend.currentBuffer.length) {
                this.viewPort.sS = oldStart;
                this.viewPort.eS = this.backend.currentBuffer.length;
            }
        }

        // check if viewPort in range
        if(this.viewPort.sS < 1) {
            this.viewPort.sS = 1;
        }
        if(this.viewPort.eS > this.backend.currentBuffer.length){
            this.viewPort.eS = this.backend.currentBuffer.length;
        }
        if(this.viewPort.eS-this.viewPort.sS < 4){
            this.viewPort.sS = oldStart;
            this.viewPort.eS = oldEnd;
        }
        this.drawBuffer();

    },


    zoomViewPort: function(zoomInBool){
        
        this.removeCanvasDoubleClick();
        var newStartS, newEndS;
        if(zoomInBool){
            newStartS = this.viewPort.sS + ~~((this.viewPort.eS-this.viewPort.sS)/4);
            newEndS = this.viewPort.eS - ~~((this.viewPort.eS-this.viewPort.sS)/4);
        }else{
            newStartS = this.viewPort.sS - ~~((this.viewPort.eS-this.viewPort.sS)/4);
            newEndS = this.viewPort.eS + ~~((this.viewPort.eS-this.viewPort.sS)/4);

        }
        this.setView(newStartS, newEndS);

    },

    incrViewP: function  (inc) {
        my.removeCanvasDoubleClick();
        var newStartS, newEndS;
        if(inc){
            newStartS = this.viewPort.sS + ~~((this.viewPort.eS-this.viewPort.sS)/4);
            newEndS = this.viewPort.eS + ~~((this.viewPort.eS-this.viewPort.sS)/4);
        }else{
            newStartS = this.viewPort.sS - ~~((this.viewPort.eS-this.viewPort.sS)/4);
            newEndS = this.viewPort.eS - ~~((this.viewPort.eS-this.viewPort.sS)/4);

        }
        this.setView(newStartS, newEndS);


    },

    zoomSel: function () {
        this.setView(this.viewPort.selectS, this.viewPort.selectE);
    },

    
    getX: function(e) {
        var relX = e.offsetX;
        if (null === relX) { relX = e.layerX; }
        return relX/e.srcElement.clientWidth;
    },
    
    getY: function(e) {
        var relY = e.offsetY;
        if (null === relY) { relX = e.layerY; }
        return relY/e.srcElement.clientHeight;
    },    

    getTierID: function(e) {
        return document.getElementById(e.srcElement.id).getAttribute("tier-id");
    }, 
    
    getElement: function(e) {
        return document.getElementById(e.srcElement.id);
    },     
    



    parseNewFile: function (readerRes) {
        var my = this;
        var ft = emulabeller.newFileType;
        if(ft===0){
            console.log(readerRes);
            my.backend.loadData(
                readerRes,
                my.newlyLoadedBufferReady.bind(my)
            );
        } else if(ft==1){
            var newTiers = emulabeller.labParser.parseFile(readerRes, emulabeller.tierInfos.tiers.length);
            emulabeller.tierInfos.tiers.push(newTiers[0]);

            var tName = newTiers[0].TierName;
            $('<canvas>').attr({
                id: tName,
                width: my.internalCanvasWidth + 'px',
                height: my.internalCanvasHeightSmall + 'px',
                'tier-id': tName
            }).css({
                class: 'canvasSettings '+tName,
                width: '98%',
                height: my.internalCanvasHeightSmall + 'px'
            }).appendTo('#cans');
                
            $("#"+tName)[0].addEventListener('dblclick', function(e){
                my.canvasDoubleClick(e);
            });
            $("#"+tName)[0].addEventListener('click', function(e){
                my.setMarkedEvent(my.getX(e), my.getY(e), $("#"+tName)[0].id);
            });                
            $("#"+tName)[0].addEventListener('mousemove', function(e){
                my.trackMouseInTiers(my.getX(e), my.getTierID(e));
            });                 

            emulabeller.tierInfos.canvases.push($("#"+tName)[0]);
            emulabeller.drawer.addTier($("#"+tName)[0]);
            emulabeller.bindTierMouseUp($('#'+tName)[0], function (percX, percY, elID) {
                // console.log(percents);
                // console.log("whaaaaaaaaaat",elID);
                my.setMarkedEvent(percX, percY, elID);
            });
            this.viewPort.selTier = this.tierInfos.tiers.length-1;

            this.drawBuffer();
        } else if(ft==2){
            var sCanName = "F0";
            $("#signalcans").append("<canvas id=\""+sCanName+"\" width=\""+my.internalCanvasWidth+"\" height=\""+my.internalCanvasHeightBig+"\"></canvas>");
            $("#"+sCanName)[0].style.width = "100%";
            var ssffData = emulabeller.ssffParser.parseSSFF(readerRes);
            emulabeller.ssffInfos.data.push(ssffData);
            emulabeller.ssffInfos.canvases.push($("#"+sCanName)[0]);
            this.drawBuffer();
            // console.log(emulabeller.ssffInfos);
        }else if(ft==3){
            emulabeller.tierInfos.tiers = emulabeller.tierInfos.tiers.concat(emulabeller.tgParser.parseFile(readerRes));
            for (var i = 0; i < emulabeller.tierInfos.tiers.length; i++) {
                var tName = emulabeller.tierInfos.tiers[my.tierCounter].TierName;
                $('<canvas>').attr({
                    id: tName,
                    width: my.internalCanvasWidth + 'px',
                    height: my.internalCanvasHeightSmall + 'px',
                    'tier-id': my.tierCounter
                }).css({
                    class: 'canvasSettings',
                    width: '98%',
                    height: my.internalCanvasHeightSmall + 'px'
                }).appendTo('#cans');
                
                $("#"+tName)[0].addEventListener('dblclick', function(e){
                    my.canvasDoubleClick(e);
                });
                $("#"+tName)[0].addEventListener('click', function(e){
                    my.setMarkedEvent(my.getX(e), my.getY(e), my.getTierID(e));
                });                
                $("#"+tName)[0].addEventListener('mousemove', function(e){
                    my.trackMouseInTiers(my.getX(e), my.getTierID(e));
                });                 
                emulabeller.tierInfos.canvases.push($("#"+tName)[0]);
                emulabeller.drawer.addTier($("#"+tName)[0]); // SIC why is the drawer adding a tier???
                ++my.tierCounter;  
            }
            this.viewPort.selTier = this.tierInfos.tiers.length-1;

            this.drawBuffer();

        }
    },
    
    canvasDoubleClick: function (e) {
        var my = this;
        if ($('#textAreaPopUp').length == 0) {
            var tier = my.tierInfos.tiers[my.viewPort.selTier];
            var event = tier.events[my.viewPort.selSegment];
		    var TextY = my.tierInfos.canvases[my.viewPort.selTier].offsetTop+2;
            var all = my.viewPort.eS-my.viewPort.sS;
            var fracS = my.viewPort.selectS-my.viewPort.sS;
            var procS = fracS/all;
            var posS = my.tierInfos.canvases[my.viewPort.selTier].clientWidth*procS;
            var fracE = my.viewPort.selectE-my.viewPort.sS;
            var procE = fracE/all;
            var posE = my.tierInfos.canvases[my.viewPort.selTier].clientWidth*procE;
		    var mouseX2 = Math.floor(posE-posS-5);
		    var TextX = Math.round(posS)+12;
		    var editHeight = Math.floor(e.srcElement.attributes.clientHeight);
		    if(event!=null) {
		        var textArea = "<div id='textAreaPopUp' class='textAreaPopUp' style='top:"+TextY+"px;left:"+TextX+"px;'><textarea id='editArea' class='editArea'  wrap='off' style='width:"+mouseX2+"px;height:"+editHeight+"px;'>"+event.label+"</textarea>";
	            var saveButton = "<input type='button' value='save' id='saveText' class='mini-btn saveText'></div>";
		        var appendString = textArea + saveButton;
		        $("#tiers").append(appendString);
		        my.internalMode = my.EDITMODE.LABEL_RENAME;
                $("#saveText")[0].addEventListener('click', function(e){
                    my.saveCanvasDoubleClick();
                });	
                $("#editArea")[0].onkeyup = function(evt) {
                    evt = evt || window.event;
                    if (evt.keyCode == 13) {
                        my.saveCanvasDoubleClick();
                        my.removeCanvasDoubleClick();
                    }
                };
                my.createSelection(document.getElementById('editArea'),0,event.label.length);       // select textarea text 
		    }
	    } 
	    else {
	        my.removeCanvasDoubleClick();
	    }
    },
    
    createSelection: function(field, start, end) {
        if( field.createTextRange ) {
            var selRange = field.createTextRange();
            selRange.collapse(true);
            selRange.moveStart('character', start);
            selRange.moveEnd('character', end);
            selRange.select();
        } else if( field.setSelectionRange ) {
            field.setSelectionRange(start, end);
        } else if( field.selectionStart ) {
            field.selectionStart = start;
            field.selectionEnd = end;
        }
        field.focus();
    },      
    
    saveCanvasDoubleClick: function () {
        var my = this;
        var tier = my.tierInfos.tiers[my.viewPort.selTier];
        var event = tier.events[my.viewPort.selSegment];   
        var content = $("#editArea").val();
        event.label = content;
        my.drawBuffer();
    },   
    
    removeCanvasDoubleClick: function () {
        var my = this;
        my.internalMode = my.EDITMODE.STANDARD;
		$('textarea#editArea').remove();
		$('#saveText').remove();
	    $('#textAreaPopUp').remove();    
    },

    fileAPIread: function (evt) {
        var my = this;

        var file = evt.target.files[0];

        // Create a new FileReader Object
        var reader = new FileReader();
        // Set an onload handler because we load files into it asynchronously
        reader.onload = function(e){
            // The response contains the Data-Uri, which we can then load into the canvas
            // console.log(file.type);
            emulabeller.parseNewFile(reader.result); // my and this does not work?!

        };

        if(file.type.match('audio.*')) {
            console.log("is audio");
            emulabeller.newFileType = 0;
            reader.readAsArrayBuffer(file);
        }
        else if(file.name.match(".*lab") || file.name.match(".*tone")){
            console.log("is lab file");
            emulabeller.newFileType = 1;
            reader.readAsText(file);
        }
        else if(file.name.match(".*f0") || file.name.match(".*fms")){
            console.log("is f0");
            emulabeller.newFileType = 2;
            reader.readAsArrayBuffer(file);
        }else if(file.name.match(".*TextGrid")){
            console.log("is TextGrid");
            emulabeller.newFileType = 3;
            reader.readAsText(file);
        }
        else{
            alert('File type not supported.... sorry!');
        }

    },
    
    openSubmenu: function() {
        if(this.subMenuOpen) {
            this.subMenuOpen = false;
            $("#serverSelect").html("Open Menu");
            $("#menuLeft").removeClass("cbp-spmenu-open");
            $("#menu").removeClass("cbp-spmenu-push-toright");
            $("#timeline").removeClass("cbp-spmenu-push-toright");
            $("#tierPush").removeClass("cbp-spmenu-push-toright");
            $("#menu-bottom").removeClass("cbp-spmenu-push-toright");                
        }
        else {
            this.subMenuOpen = true;
            $("#serverSelect").html("Close Menu");
            $("#menuLeft").addClass("cbp-spmenu-open");
            $("#menu").addClass("cbp-spmenu-push-toright");
            $("#timeline").addClass("cbp-spmenu-push-toright");
            $("#tierPush").addClass("cbp-spmenu-push-toright");
            $("#menu-bottom").addClass("cbp-spmenu-push-toright");
        }
    },
    
    addTier: function (addPointTier) {
        var my = this;
        
        var tName = "Tier"+my.tierCounter;
        if(!addPointTier){
            this.tierInfos.tiers.push({TierName: tName, type: "seg", events: []});
        }else{
            this.tierInfos.tiers.push({TierName: tName, type: "point", events: []});
        }

        this.viewPort.selTier = this.tierInfos.tiers.length-1;
        this.viewPort.selSegment = -1;

        $('<canvas>').attr({
            id: tName,
            width: my.internalCanvasWidth + 'px',
            height: my.internalCanvasHeightSmall + 'px',
            'tier-id': my.tierCounter
        }).css({
            class: 'canvasSettings',
            width: '98%',
            height: my.internalCanvasHeightSmall + 'px'
        }).appendTo('#cans');
                
        $("#"+tName)[0].addEventListener('dblclick', function(e){
            my.canvasDoubleClick(e);
        });
        $("#"+tName)[0].addEventListener('click', function(e){
            my.setMarkedEvent(my.getX(e), my.getY(e), my.getTierID(e));
        });                
        $("#"+tName)[0].addEventListener('mousemove', function(e){
            my.trackMouseInTiers(my.getX(e));
        });                 

        emulabeller.tierInfos.canvases.push($("#"+tName)[0]);
        emulabeller.drawer.addTier($("#"+tName)[0]);
        ++my.tierCounter;
        this.drawBuffer();
    },

    setMarkedEvent: function (percX, percY, elID){ // SIC bad function name!! also adds labels if click is in circle

        var clickedTier = this.tierInfos.tiers[elID];
        this.viewPort.selTier = elID;
        var rXp = this.tierInfos.canvases[elID].width*percX;
        var rYp = this.tierInfos.canvases[elID].height*percY;
        var sXp = this.tierInfos.canvases[elID].width*(this.viewPort.selectS / (this.viewPort.eS-this.viewPort.sS));

        if(this.viewPort.selectS == this.viewPort.selectE && Math.abs(rXp-sXp) <= 5 && rYp < 10){
            console.log("hit the circle")
            this.addSegmentAtSelection();
        } else if(clickedTier.type=="seg"){
            var curSample = this.viewPort.sS + (this.viewPort.eS-this.viewPort.sS)*percX;
            for (var i = 0; i < clickedTier.events.length; i++) {
                if (curSample < clickedTier.events[i].time) {
                    var clickedEvtNr = i;
                    break;
                }
            }

            if(clickedTier.events.length > 0 && clickedTier.events[clickedEvtNr-1] && clickedTier.events[clickedEvtNr]){
                this.viewPort.selSegment = clickedEvtNr;
                // this.setView(clickedTier.events[clickedEvtNr-1].time, clickedTier.events[clickedEvtNr].time);
                this.viewPort.selectS = clickedTier.events[clickedEvtNr-1].time;
                this.viewPort.selectE = clickedTier.events[clickedEvtNr].time;
            }else{
                this.viewPort.selSegment = -1;
            }

        }else{
            this.viewPort.selSegment = -1;
        }

        this.drawBuffer();
    },

    showHideTierDial: function () {
        emulabeller.isModalShowing = true;
        $( "#dialog-messageSh" ).dialog({
          modal: true,
          close: function() {
            console.log("closing");
            emulabeller.isModalShowing = false;
          },
          buttons: {
            Ok: function() {
                $( this ).dialog( "close" );
                var usrTxt = $("#dialShInput")[0].value;
                // emulabeller.tierInfos.tiers[0] = {};
                // emulabeller.tierInfos.canvases[0] = {};
                $("#"+usrTxt).slideToggle();
                emulabeller.isModalShowing = false;
            }
          }
        });
    },

    editLabel: function () {
        var my = this;
        console.log(this.tierInfos.tiers[this.viewPort.selTier].events[this.viewPort.selSegment].label);
        this.isModalShowing = true;
        $("#dialLabelInput")[0].value = this.tierInfos.tiers[this.viewPort.selTier].events[this.viewPort.selSegment].label;
        $("#dialog-messageSetLabel" ).dialog({
          modal: true,
          close: function() {
            console.log("closing");
            emulabeller.isModalShowing = false;
          },
          buttons: {
            Ok: function() {
                $( this ).dialog( "close" );
                var usrTxt = $("#dialLabelInput")[0].value;
                // this.tierInfos.tiers[this.viewPort.selTier].events[this.viewPort.selSegment].label = usrTxt;
                console.log(my.tierInfos.tiers[my.viewPort.selTier].events[my.viewPort.selSegment].label);
                my.tierInfos.tiers[my.viewPort.selTier].events[my.viewPort.selSegment].label = usrTxt;
                my.drawBuffer();
            }
          }
        });

    },

    moveSelTierToTop: function () {
        var stN = this.tierInfos.tiers[this.viewPort.selTier].TierName;
        $('#'+stN).prependTo('#cans');

    },

    sendTierinfosToServer: function () {
        var sT = this.tierInfos.tiers[this.viewPort.selTier];
        console.log(sT);
        var data = {'bob':'foo','paul':'dog'};
        $.ajax({
            url: "http://127.0.0.1:8001/",
            type: 'POST',
            contentType:'application/json',
            data: JSON.stringify(sT),
            dataType:'json'
        });
    },

    addSegmentAtSelection: function() {

        var sT = emulabeller.tierInfos.tiers[emulabeller.viewPort.selTier];

        if(emulabeller.viewPort.selectS == emulabeller.viewPort.selectE){
            console.log("adding segments");
            sT.events.push({label:"", time:emulabeller.viewPort.selectS});
            console.log(sT.events);
        }else{
            sT.events.push({label:"", time:emulabeller.viewPort.selectS});
            sT.events.push({label:"", time:emulabeller.viewPort.selectE});
        }

        //resort events here!
        var bla = sT.events.sort(function(a,b) { return parseFloat(a.time) - parseFloat(b.time) } );
        console.log(bla);
        console.log(sT.events);

        emulabeller.drawBuffer();
    },

    validateTierInfos: function () {
        this.JSONval.validateTierInfos(this.tierInfos);
    },
    // saveTiers: function () {
    //     var myObject = {one: "weee", two: "woooo"};
    //     console.log(this.tierInfos.tiers);
    //     var data = JSON.stringify(this.tierInfos.tiers);
    //     // console.log(data);

    //     var url = "data:application/octet-stream;base64," + window.btoa(data);
    //     var iframe;
    //     iframe = document.getElementById("hiddenDownloader");
    //     if (iframe === null)
    //     {
    //         iframe = document.createElement('iframe');
    //         iframe.id = "hiddenDownloader";
    //         iframe.style.display = "none";
    //         document.body.appendChild(iframe);
    //     }
    //     iframe.src = url;
    // },
    prepDownload: function() {
        var MIME_TYPE = 'text/plain';

        var output = document.querySelector('output');

        window.URL = window.webkitURL || window.URL;

        console.log(window.URL);

        var prevLink = output.querySelector('a');
        if (prevLink) {
            window.URL.revokeObjectURL(prevLink.href);
            output.innerHTML = '';
        }

        var bb = new Blob([JSON.stringify(this.tierInfos.tiers)], {type: MIME_TYPE});

        var a = document.createElement('a');
        a.download = "emulabellerjsOutput.txt";
        a.href = window.URL.createObjectURL(bb);
        a.textContent = 'Download ready';

        a.dataset.downloadurl = [MIME_TYPE, a.download, a.href].join(':');
        a.draggable = true; // Don't really need, but good practice.
        a.classList.add('dragout');

        output.appendChild(a);

        a.onclick = function(e) {
            if ('disabled' in this.dataset) {
              return false;
            }
            a.textContent = 'Downloaded';
            a.dataset.disabled = true;
            // cleanUp(this);
          };
    },

    trackMouseInTiers: function(percX){
        my = this;
        if(this.viewPort.selTier != -1 ) { 
        var clickedTier = this.tierInfos.tiers[this.viewPort.selTier];   
        var curSample = this.viewPort.sS + (this.viewPort.eS-this.viewPort.sS)*percX;
        var dists = new Array(clickedTier.events.length);
        for (var i = 0; i < clickedTier.events.length; i++) {
            dists[i] = Math.abs(clickedTier.events[i].time - curSample);
        }
        var closest = dists.indexOf(Math.min.apply(Math, dists));
        this.viewPort.selBoundaries[0] = closest;
        }
    },

    /**
    use socketIOhandler to request something from server
    @param message sting containing request statement from
    server "getUtts" and "stopServer" work for now
    */
    requestFromServer: function(message){

        console.log("sending message: ", message);
        this.socketIOhandler.doSend(message);

        if(message=="stopServer"){
            window.close();
        }

    }

};

