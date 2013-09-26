define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('panelMove', function(dashboard, $rootScope, alertSrv) {

    /* each of these can take event,ui,data parameters */

    var notices = [];

    this.onStart = function() {
      dashboard.panelDragging =  true;
      notices.push(alertSrv.set('Moving','Drop this panel into an empty space, or on top of another panel','info'));
      $rootScope.$apply();
    };

    this.onOver = function(event,ui,data,replace) {
      if(replace) {
        notices.push(alertSrv.set('Swap panel',
          'Drop to swap these panels. Panels will use row height, but retain their span','success'));
      } else {
        notices.push(alertSrv.set('Add panel',
          'Drop to add to this row. Panel will use row height, but retain their span','success'));
      }
      $rootScope.$apply();
    };

    this.onOut = function() {
      clearNotices({severity:'success'});
      $rootScope.$apply();
    };

    this.onDrop = function() {
      dashboard.panelDragging = false;
      // Cleanup nulls/undefined left behind
      cleanup();
      $rootScope.$apply();
      $rootScope.$broadcast('render');
    };

    this.onStop = function() {
      dashboard.panelDragging = false;
      cleanup();
      $rootScope.$apply();
    };

    var cleanup = function () {
      _.each(notices, function(n){
        alertSrv.clear(n);
      });
      _.each(dashboard.current.rows, function(row) {
        row.panels = _.without(row.panels,{});
        row.panels = _.compact(row.panels);
      });
    };

    var clearNotices = function(options) {
      _.each(_.where(notices,options), function(n) {
        alertSrv.clear(n);
      });
    };

  });

});