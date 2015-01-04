define([
  'settings',
],
function (Settings) {
  "use strict";

  var bootData = window.grafanaBootData;
  var options = bootData.settings;

  return new Settings(options);

});
