(function() {
    'use strict';
  
    var page = require('webpage').create();
    var args = require('system').args;
    var params = {};
    var regexp = /^([^=]+)=([^$]+)/;
  
    args.forEach(function(arg) {
      var parts = arg.match(regexp);
      if (!parts) { return; }
      params[parts[1]] = parts[2];
    });
  
    var usage = "url=<url> png=<filename> width=<width> height=<height> renderKey=<key>";
  
    if (!params.url || !params.png ||  !params.renderKey || !params.domain) {
      console.log(usage);
      phantom.exit();
    }
  
    phantom.addCookie({
      'name': 'renderKey',
      'value': params.renderKey,
      'domain': params.domain,
    });
  
    page.viewportSize = {
      width: params.width || '800',
      height: params.height || '400'
    };
  
    var timeoutMs = (parseInt(params.timeout) || 10) * 1000;
    var waitBetweenReadyCheckMs = 50;
    var totalWaitMs = 0;
  
    page.open(params.url, function (status) {
      console.log('Loading a web page: ' + params.url + ' status: ' + status, timeoutMs);
  
      page.onError = function(msg, trace) {
        var msgStack = ['ERROR: ' + msg];
        if (trace && trace.length) {
          msgStack.push('TRACE:');
          trace.forEach(function(t) {
            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
          });
        }
        console.error(msgStack.join('\n'));
      };
  
      function checkIsReady() {
        var panelsRendered = page.evaluate(function() {
          if (!window.angular) { return false; }
          var body = window.angular.element(document.body);
          if (!body.injector) { return false; }
          if (!body.injector()) { return false; }
  
          var rootScope = body.injector().get('$rootScope');
          if (!rootScope) {return false;}
          var panels = angular.element('div.panel:visible').length;
          return rootScope.panelsRendered >= panels;
        });
  
        if (panelsRendered || totalWaitMs > timeoutMs) {
          var bb = page.evaluate(function () {
            return document.getElementsByClassName("main-view")[0].getBoundingClientRect();
          });
  
          page.clipRect = {
            top:    bb.top,
            left:   bb.left,
            width:  bb.width,
            height: bb.height
          };
  
          page.render(params.png);
          phantom.exit();
        } else {
          totalWaitMs += waitBetweenReadyCheckMs;
          setTimeout(checkIsReady, waitBetweenReadyCheckMs);
        }
      }
  
      setTimeout(checkIsReady, waitBetweenReadyCheckMs);
    });
  })();