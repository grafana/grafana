var page = require('webpage').create();
var args = require('system').args;
var params = {};
var regexp = /^([^=]+)=([^$]+)/;

args.forEach(function(arg) {
  var parts = arg.match(regexp);
  if (!parts) { return; }
  params[parts[1]] = parts[2];
});

var usage = "url=<url> png=<filename> width=<width> height=<height> cookiename=<cookiename> sessionid=<sessionid> domain=<domain>";

if (!params.url || !params.png || !params.cookiename || ! params.sessionid || !params.domain) {
  console.log(usage);
  phantom.exit();
}

phantom.addCookie({
  'name': params.cookiename,
  'value': params.sessionid,
  'domain': params.domain
});

page.viewportSize = {
  width: params.width || '800',
  height: params.height || '400'
};

var tries = 0;

page.open(params.url, function (status) {
  console.log('Loading a web page: ' + params.url);

  function checkIsReady() {
    var canvas = page.evaluate(function() {
      var body = angular.element(document.body);   // 1
      var rootScope = body.scope().$root;
      var panels = angular.element('div.panel').length;
      return rootScope.performance.panelsRendered >= panels;
    });

    if (canvas || tries === 1000) {
      page.render(params.png);
      phantom.exit();
    }
    else {
      tries++;
      setTimeout(checkIsReady, 10);
    }
  }

  setTimeout(checkIsReady, 200);

});
