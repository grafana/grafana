define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('RowCtrl', function($scope, $rootScope, $timeout) {
    var _d = {
      title: "Row",
      height: "150px",
      collapse: false,
      collapsable: true,
      editable: true,
      panels: [],
      notice: false
    };

    _.defaults($scope.row,_d);

    $scope.init = function() {
      $scope.reset_panel();
    };

    $scope.toggle_row = function(row) {
      if(!row.collapsable) {
        return;
      }
      row.collapse = row.collapse ? false : true;
      if (!row.collapse) {
        $timeout(function() {
          $scope.$broadcast('render');
        });
      } else {
        row.notice = false;
      }
    };

    $scope.rowSpan = function(row) {
      var panels = _.filter(row.panels, function(p) {
        return $scope.isPanel(p);
      });
      return _.reduce(_.pluck(panels,'span'), function(p,v) {
        return p+v;
      },0);
    };

    // This can be overridden by individual panels
    $scope.close_edit = function() {
      $scope.$broadcast('render');
    };

    $scope.add_panel = function(row,panel) {
      $scope.row.panels.push(panel);
    };

    $scope.remove_panel_from_row = function(row, panel) {
      if (confirm('Are you sure you want to remove this ' + panel.type + ' panel?')) {
        row.panels = _.without(row.panels,panel);
      }
    };

    $scope.duplicatePanel = function(panel, row) {
      row = row || $scope.row;
      var currentRowSpan = $scope.rowSpan(row);
      if (currentRowSpan <= 9) {
        row.panels.push(angular.copy(panel));
      }
      else {
        var rowsList = $scope.dashboard.current.rows;
        var rowIndex = _.indexOf(rowsList, row);
        if (rowIndex === rowsList.length - 1) {
          var newRow = angular.copy($scope.row);
          newRow.panels = [];
          $scope.dashboard.current.rows.push(newRow);
          $scope.duplicatePanel(panel, newRow);
        }
        else {
          $scope.duplicatePanel(panel, rowsList[rowIndex+1]);
        }
      }
    };

    /** @scratch /panels/0
     * [[panels]]
     * = Panels
     *
     * [partintro]
     * --
     * *Kibana* dashboards are made up of blocks called +panels+. Panels are organized into rows
     * and can serve many purposes, though most are designed to provide the results of a query or
     * multiple queries as a visualization. Other panels may show collections of documents or
     * allow you to insert instructions for your users.
     *
     * Panels can be configured easily via the Kibana web interface. For more advanced usage, such
     * as templated or scripted dashboards, documentation of panel properties is available in this
     * section. You may find settings here which are not exposed via the web interface.
     *
     * Each panel type has its own properties, hover there are several that are shared.
     *
    */

    $scope.reset_panel = function(type) {
      var
        defaultSpan = 4,
        _as = 12-$scope.rowSpan($scope.row);

      $scope.panel = {
        error   : false,
        /** @scratch /panels/1
         * span:: A number, 1-12, that describes the width of the panel.
         */
        span    : _as < defaultSpan && _as > 0 ? _as : defaultSpan,
        /** @scratch /panels/1
         * editable:: Enable or disable the edit button the the panel
         */
        editable: true,
        /** @scratch /panels/1
         * type:: The type of panel this object contains. Each panel type will require additional
         * properties. See the panel types list to the right.
         */
        type    : type
      };

      if (!$scope.row.height) {
        $scope.row.height = "200px";
      }
      else if($scope.row.height.indexOf('px') === -1) {
        $scope.row.height = $scope.row.height + 'px';
      }
    };

    /** @scratch /panels/2
     * --
     */

    $scope.init();

  });

});