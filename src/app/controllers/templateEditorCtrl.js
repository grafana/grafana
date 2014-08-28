define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('TemplateEditorCtrl', function($scope, datasourceSrv, templateSrv, templateValuesSrv) {

    var replacementDefaults = {
      type: 'query',
      datasource: null,
      refresh_on_load: false,
      name: '',
      options: [],
    };

    $scope.init = function() {
      $scope.editor = { index: 0 };
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.currentDatasource = _.findWhere($scope.datasources, { default: true });
      $scope.variables = templateSrv.variables;
      $scope.reset();

      _.each($scope.variables, function(variable) {
        if (variable.datasource === void 0) {
          variable.datasource = null;
          variable.type = 'query';
        }
      });

      $scope.$watch('editor.index', function(index) {
        if ($scope.currentIsNew === false && index === 1) {
          $scope.reset();
        }
      });
    };

    $scope.add = function() {
      $scope.current.datasource = $scope.currentDatasource.name;
      $scope.variables.push($scope.current);
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.runQuery = function() {
      templateValuesSrv.updateOptions($scope.current);
    };

    $scope.edit = function(variable) {
      $scope.current = variable;
      $scope.currentIsNew = false;
      $scope.currentDatasource = _.findWhere($scope.datasources, { name: variable.datasource });

      if (!$scope.currentDatasource) {
        $scope.currentDatasource = $scope.datasources[0];
      }

      $scope.editor.index = 2;
    };

    $scope.update = function() {
      templateValuesSrv.updateOptions($scope.current);
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.reset = function() {
      $scope.currentIsNew = true;
      $scope.current = angular.copy(replacementDefaults);
    };

    $scope.typeChanged = function () {
      if ($scope.current.type === 'time period') {
        $scope.current.query = 'auto,1m,10m,30m,1h,6h,12h,1d,7d,14d,30d';
        $scope.current.auto_count = 10;
      }
    };

    $scope.removeVariable = function(variable) {
      var index = _.indexOf($scope.variables, variable);
      $scope.variables.splice(index, 1);
    };

  });

});
