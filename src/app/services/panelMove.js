define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('panelMoveSrv', function($rootScope) {

    function PanelMoveSrv(dashboard) {
      this.dashboard = dashboard;
      _.bindAll(this, 'onStart', 'onOver', 'onOut', 'onDrop', 'onStop', 'cleanup');
    }

    var p = PanelMoveSrv.prototype;

    /* each of these can take event,ui,data parameters */
    p.onStart = function() {
      this.dashboard.panelDragging =  true;
      $rootScope.$apply();
    };

    p.onOver = function() {
      $rootScope.$apply();
    };

    p.onOut = function() {
      $rootScope.$apply();
    };

    /*
      Use our own drop logic. the $parent.$parent this is ugly.
    */
    p.onDrop = function(event,ui,data) {
      var
        dragRow = data.draggableScope.$parent.$parent.row.panels,
        dropRow =  data.droppableScope.$parent.$parent.row.panels,
        dragIndex = data.dragSettings.index,
        dropIndex =  data.dropSettings.index;

      // Remove panel from source row
      dragRow.splice(dragIndex,1);

      // Add to destination row
      if (!_.isUndefined(dropRow)) {
        dropRow.splice(dropIndex,0,data.dragItem);
      }

      this.dashboard.panelDragging = false;
      // Cleanup nulls/undefined left behind
      this.cleanup();
      $rootScope.$apply();
      $rootScope.$broadcast('render');
    };

    p.onStop = function() {
      this.dashboard.panelDragging = false;
      this.cleanup();
      $rootScope.$apply();
    };

    p.cleanup = function () {
      _.each(this.dashboard.rows, function(row) {
        row.panels = _.without(row.panels,{});
        row.panels = _.compact(row.panels);
      });
    };

    return {
      create: function(dashboard) {
        return new PanelMoveSrv(dashboard);
      }
    };

  });

});