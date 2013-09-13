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
        }
      };

      // This can be overridden by individual panels
      $scope.close_edit = function() {
        $scope.$broadcast('render');
      };

      $scope.add_panel = function(row,panel) {
        $scope.row.panels.push(panel);
      };

      $scope.reset_panel = function(type) {
        $scope.panel = {
          error   : false,
          span    : 3,
          editable: true,
          type    : type
        };
      };

      $scope.init();

    }
  );

});