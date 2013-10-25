define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('RowCtrl', function($scope, $rootScope, $timeout,ejsResource, querySrv) {
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
        $scope.querySrv = querySrv;
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

      $scope.reset_panel = function(type) {
        var
          defaultSpan = 4,
          _as = 12-$scope.rowSpan($scope.row);

        $scope.panel = {
          error   : false,
          span    : _as < defaultSpan && _as > 0 ? _as : defaultSpan,
          editable: true,
          type    : type
        };
      };

      $scope.init();

    }
  );

});