/**
 * Javascript SCORM API wrapper (v2.0)
 * 
 * This wrapper is designed to QuizCreator 3.0 and support SCORM 1.2.
 * 
 * Copyright (c) 2009 Wondershare e-Learning
 * 
 * Created By Oscar Woo, 2009-07-25
 *
 * 修改说明:
 * 
 * 修复了API查找失败的问题，主要更新和新增了2个函数: getAPI()、ScanParentsForApi() 。
 *
 * 已经在 www.scorm.com 上测试通过。
 *
 * Created By Fengxb, 2010.2.24
 *
 **/

 
var g_bShowApiErrors = false;
var g_bInitializeOnLoad = true;
var g_strAPINotFound      = "Management system interface not found.";
var g_strAPITooDeep       = "Cannot find API - too deeply nested.";
var g_strAPIInitFailed    = "Found API but LMSInitialize failed.";
var g_strAPISetError      = "Trying to set value but API not available.";
var g_strFSAPIError       = 'LMS API adapter returned error code: "%1"\nWhen FScommand called API.%2\nwith "%3"';
var g_strDisableErrorMsgs = "Select cancel to disable future warnings.";
var g_bSetCompletedAutomatically = false;
var g_nfindAPITries = 0;
var g_objAPI = null;
var g_bInitDone = false;
var g_bFinishDone = false;
var g_bSCOBrowse = false;
var g_SCOStatus = "not attempted";
var g_dtmInitialized = new Date();
var MAX_PARENTS_TO_SEARCH = 500;

var sameshow = {};									//sameshow 'namespace' helps ensure no conflicts with possible other "SCORM" variables
sameshow.utils = {};
sameshow.debug = { isActive: true }; 				//Enable (true) or disable (false) for debug mode
sameshow.SCORM = {									//Define the SCORM object
    version:    null,               				
    session: {},									//Create session child object
    data: {},										//Create data child object
    support: {}										//Create support child object
};

function alertUserOfAPIError(strText) {
	if (g_bShowApiErrors) {
		var s = strText + "\n\n" + g_strDisableErrorMsgs;
		if (!confirm(s)) {
			g_bShowApiErrors = false;
		}
	}
}

function expandString(s) {
	var re = new RegExp("%", "g");
	for (i = arguments.length - 1; i > 0; i--) {
		s2 = "%" + i;
		if (s.indexOf(s2) > -1) {
			re.compile(s2, "g");
			s = s.replace(re, arguments[i]);
		}
	}
	return s;
}


function ScanParentsForApi(win) 
{ 	  
      var nParentsSearched = 0;
      while ( (win.API == null) && 

                  (win.parent != null) && (win.parent != win) && 

                  (nParentsSearched <= MAX_PARENTS_TO_SEARCH) 

              )

      { 
            nParentsSearched++; 
            win = win.parent;

      } 
      return win.API; 
}  

function getAPI() 
{ 
      var API = null; 
      if ((window.parent != null) && (window.parent != window)) 
      { 
            API = ScanParentsForApi(window.parent); 
      } 
      if ((API == null) && (window.top.opener != null))
      { 
            API = ScanParentsForApi(window.top.opener); 

      }	  
      return API;
}

function hasAPI() {
	return ((typeof (g_objAPI) != "undefined") && (g_objAPI != null));
}

function SCOInitialize() {
	var err = true;
	if (!g_bInitDone) {
		g_bInitDone = true;
		g_objAPI = getAPI();	
    	
		if (!hasAPI()) {
			alertUserOfAPIError(g_strAPINotFound);
			err = false;
		}
		else {
			err = g_objAPI.LMSInitialize("");
			if (err == "true") {
				g_bSCOBrowse = (g_objAPI.LMSGetValue("cmi.core.lesson_mode") == "browse");
				if (!g_bSCOBrowse) {
					if (g_objAPI.LMSGetValue("cmi.core.lesson_status") == "not attempted") {
						g_objAPI.LMSSetValue("cmi.core.exit", "suspend");
						err = g_objAPI.LMSSetValue("cmi.core.lesson_status", "incomplete");
					}
				}
			}
			else {
				alertUserOfAPIError(g_strAPIInitFailed);
			}
		}
		if (typeof (SCOInitData) != "undefined") {
			SCOInitData();
		}
		g_dtmInitialized = new Date();
	}
	
	return (err + "");
}

function SCOFinish() {
	if ((hasAPI()) && (g_bFinishDone == false)) {
		SCOReportSessionTime();
		if (g_bSetCompletedAutomatically) {
			SCOSetStatusCompleted();
		}
		if (typeof (SCOSaveData) != "undefined") {
			SCOSaveData();
		}
		g_bFinishDone = (g_objAPI.LMSFinish("") == "true");
	}
	return (g_bFinishDone + "");
}

function SCOGetValue(nam) {
	return ((hasAPI()) ? g_objAPI.LMSGetValue(nam.toString()) : "");
}

function SCOCommit() {
	return ((hasAPI()) ? g_objAPI.LMSCommit("") : "false");
}

function SCOGetLastError() {
	return ((hasAPI()) ? g_objAPI.LMSGetLastError() : "-1");
}

function SCOGetErrorString(n) {
	return ((hasAPI()) ? g_objAPI.LMSGetErrorString(n) : "No API");
}
function SCOGetDiagnostic(p) {
	return ((hasAPI()) ? g_objAPI.LMSGetDiagnostic(p) : "No API");
}

function SCOSetValue(nam, val) {
	if (!hasAPI()) {
		alertUserOfAPIError(g_strAPISetError + "\n" + nam + "\n" + val);
		return "false";
	}
	if (nam == "cmi.core.lesson_status") {
		g_SCOStatus = val;
	}

  return g_objAPI.LMSSetValue(nam, val.toString());
}

function MillisecondsToCMIDuration(n) {
	var hms = "";
	var dtm = new Date();
	dtm.setTime(n);
	var h = "000" + Math.floor(n / 3600000);
	var m = "0" + dtm.getMinutes();
	var s = "0" + dtm.getSeconds();
	var cs = "0" + Math.round(dtm.getMilliseconds() / 10);
	hms = h.substr(h.length - 4) + ":" + m.substr(m.length - 2) + ":";
	hms += s.substr(s.length - 2) + "." + cs.substr(cs.length - 2);
	return hms;
}

function SCOReportSessionTime() {
	var dtm = new Date();
	var n = dtm.getTime() - g_dtmInitialized.getTime();
	return SCOSetValue("cmi.core.session_time", MillisecondsToCMIDuration(n));
}

function SCOSetStatusCompleted() {
	if (!g_bSCOBrowse) {
		SCOSetValue("cmi.core.exit", "");
		if ((g_SCOStatus != "completed") && (g_SCOStatus != "passed") && (g_SCOStatus != "failed")) {
  	  return SCOSetValue("cmi.core.lesson_status", "completed");
		}
	}
	else {
		return "false";
	}
}

function SCOSetObjectiveData(id, elem, v) {
	var result = "false";
	var i = SCOGetObjectiveIndex(id);
	if (isNaN(i)) {
		i = parseInt(SCOGetValue("cmi.objectives._count"));
		if (isNaN(i)) {
			i = 0;
		}
		if (SCOSetValue("cmi.objectives." + i + ".id", id) == "true") {
			result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
		}
	}
	else {
		result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
		if (result != "true") {
			i = parseInt(SCOGetValue("cmi.objectives._count"));
			if (!isNaN(i)) {
				if (SCOSetValue("cmi.objectives." + i + ".id", id) == "true") {
					result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
				}
			}
		}
	}
	return result;
}

function SCOSetObjectiveData(id, elem, v) {
	var result = "false";
	var i = SCOGetObjectiveIndex(id);
	if (isNaN(i)) {
		i = parseInt(SCOGetValue("cmi.objectives._count"));
		if (isNaN(i)) {
			i = 0;
		}
		if (SCOSetValue("cmi.objectives." + i + ".id", id) == "true") {
			result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
		}
	}
	else {
		result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
		if (result != "true") {
			i = parseInt(SCOGetValue("cmi.objectives._count"));
			if (!isNaN(i)) {
				if (SCOSetValue("cmi.objectives." + i + ".id", id) == "true") {
					result = SCOSetValue("cmi.objectives." + i + "." + elem, v);
				}
			}
		}
	}
	return result;
}

function SCOGetObjectiveData(id, elem) {
	var i = SCOGetObjectiveIndex(id);
	if (!isNaN(i)) {
		return SCOGetValue("cmi.objectives." + i + "." + elem);
	}
	return "";
}

function SCOGetObjectiveIndex(id) {
	var i = -1;
	var nCount = parseInt(SCOGetValue("cmi.objectives._count"));
	if (!isNaN(nCount)) {
		for (i = nCount - 1; i >= 0; i--) {
			if (SCOGetValue("cmi.objectives." + i + ".id") == id) {
				return i;
			}
		}
	}
	return NaN;
}

function AICCTokenToSCORMToken(strList, strTest) {
	var a = strList.split(",");
	var c = strTest.substr(0, 1).toLowerCase();
	for (i = 0; i < a.length; i++) {
		if (c == a[i].substr(0, 1)) {
			return a[i];
		}
	}
	return strTest;
}

function normalizeStatus(status) {
	return AICCTokenToSCORMToken("completed,incomplete,not attempted,failed,passed", status);
}

function normalizeInteractionType(theType) {
	return AICCTokenToSCORMToken("true-false,choice,fill-in,matching,performance,sequencing,likert,numeric", theType);
}

function normalizeInteractionResult(result) {
	return AICCTokenToSCORMToken("correct,wrong,unanticipated,neutral", result);
}

var g_bIsIE = navigator.appName.indexOf("Microsoft") != -1;

function sf_DoFSCommand(command, args) {
	var loaderObj = g_bIsIE ? sf : document.sf;
	var myArgs = new String(args);
	var cmd = new String(command);
	var v = "";
	var err = "true";
	var arg1, arg2, n, s, i;
	var sep = myArgs.indexOf(",");
	if (sep > -1) {
		arg1 = myArgs.substr(0, sep);
		arg2 = myArgs.substr(sep + 1);
	}
	else {
		arg1 = myArgs;
	}
	
	if (cmd.substring(0, 3) == "LMS") {
		if (cmd == "LMSInitialize") {
			err = SCOInitialize();
		}
		else if (cmd == "LMSSetValue") {
			err = SCOSetValue(arg1, arg2);
		}
		else if (cmd == "LMSFinish") {
			err = SCOFinish();
		}
		else if (cmd == "LMSComplete") {
			err = SCOSetStatusCompleted();
		}
		else if (cmd == "LMSCommit") {
			err = SCOCommit();
		}
		else if (cmd == "LMSFlush") {

		}
		else if ((arg2) && (arg2.length > 0)) {
			if (cmd == "LMSGetValue") {
				loaderObj.SetVariable(arg2, SCOGetValue(arg1));
			}
			else if (cmd == "LMSGetLastError") {
				loaderObj.SetVariable(arg2, SCOGetLastError(arg1));
			}
			else if (cmd == "LMSGetErrorString") {
				loaderObj.SetVariable(arg2, SCOGetErrorString(arg1));
			}
			else if (cmd == "LMSGetDiagnostic") {
				loaderObj.SetVariable(arg2, SCOGetDiagnostic(arg1));
			}
			else {
				v = eval('g_objAPI.' + cmd + '(\"' + arg1 + '\")');
				loaderObj.SetVariable(arg2, v);
			}
		}
		else if (cmd.substring(0, 3) == "LMSGet") {
			err = "-2: No Flash variable specified";
		}

	}
	if ((g_bShowApiErrors) && (err != "true")) {
		alertUserOfAPIError(expandString(g_strFSAPIError, err, cmd, args));
	}
	
	return err;
}

sameshow.SCORM.isAvailable = function(){
	return true;     
};

sameshow.SCORM.session.initialize = function (){
	return SCOInitialize();
}
sameshow.SCORM.session.terminate = function (){
	return SCOFinish();
}
sameshow.SCORM.data.commit = function (){
	return SCOCommit();
}
sameshow.SCORM.data.get = function(parameter){
	return SCOGetValue(parameter);
}
sameshow.SCORM.data.set = function(parameter, value){
	return SCOSetValue(parameter, value);
}
sameshow.SCORM.support.getLastError = function (){
	return SCOGetLastError();	
}
sameshow.SCORM.support.getErrorString = function(errorCode){
	return SCOGetErrorString(errorCode);
}
sameshow.SCORM.support.getDiagnostic = function(errorCode){
	return SCOGetDiagnostic(errorCode);
}

/* -------------------------------------------------------------------------
   sameshow.utils.trace()
   Displays error messages when in debug mode.

   Parameters: msg (string)  
   Return:     None
---------------------------------------------------------------------------- */

sameshow.utils.trace = function(msg){

     if(sameshow.debug.isActive){
     
		//Firefox users can use the 'Firebug' extension's console.
		if(window.console && window.console.firebug){
			console.log(msg);
		} else {
			//alert(msg);
		}
		
     }
};
