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
      notices.push(alertSrv.set('Moving','Drop this panel into an available space, or on top of another panel','info'));
      $rootScope.$apply();
    };

    this.onOver = function() {
      notices.push(alertSrv.set('Add panel',
          'Drop to add panel to this row. Panel will use row height, but retain their span','success'));
      $rootScope.$apply();
    };

    this.onOut = function() {
      clearNotices({severity:'success'});
      $rootScope.$apply();
    };

    /*
      Use our own drop logic. the $parent.$parent this is ugly.
    */
    this.onDrop = function(event,ui,data) {
      var
        dragRow = data.draggableScope.$parent.$parent.row.panels,
        dropRow =  data.droppableScope.$parent.$parent.row.panels,
        dragIndex = data.dragSettings.index,
        dropIndex =  data.dropSettings.index;


      // Remove panel from source row
      dragRow.splice(dragIndex,1);

      // Add to destination row
      if(!_.isUndefined(dropRow)) {
        dropRow.splice(dropIndex,0,data.dragItem);
      }

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