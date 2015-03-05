var page = require('webpage').create();
var args = require('system').args;
var params = {};
var regexp = /^([^=]+)=([^$]+)/;

args.forEach(function(arg) {
  var parts = arg.match(regexp);
  if (!parts) { return; }
  params[parts[1]] = parts[2];
});

var usage = "url=<url> png=<filename> width=<width> height=<height>";

if (!params.url || !params.png) {
  console.log(usage);
  phantom.exit();
}

page.viewportSize = {
  width: params.width || '800',
  height: params.height || '400'
};

var tries = 0;

page.open(params.url, function (status) {
  console.log('Loading a web page: ' + params.url);

  function checkIsReady() {
    var canvas = page.evaluate(function() {
      return $('canvas').length > 0;
    });

    if (canvas || tries === 10) {
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
