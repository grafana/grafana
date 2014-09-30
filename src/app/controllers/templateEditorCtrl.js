define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('TemplateEditorCtrl', function($scope, datasourceSrv, templateSrv, templateValuesSrv, alertSrv) {

    var replacementDefaults = {
      type: 'query',
      datasource: null,
      refresh_on_load: false,
      name: '',
      options: [],
      includeAll: false,
      allFormat: 'glob',
    };

    $scope.init = function() {
      $scope.editor = { index: 0 };
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.variables = templateSrv.variables;
      $scope.reset();

      $scope.$watch('editor.index', function(index) {
        if ($scope.currentIsNew === false && index === 1) {
          $scope.reset();
        }
      });
    };

    $scope.add = function() {
      $scope.variables.push($scope.current);
      $scope.update();
    };

    $scope.runQuery = function() {
      return templateValuesSrv.updateOptions($scope.current).then(function() {
      }, function(err) {
        alertSrv.set('Templating', 'Failed to run query for variable values: ' + err.message, 'error');
      });
    };

    $scope.edit = function(variable) {
      $scope.current = variable;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;

      if ($scope.current.datasource === void 0) {
        $scope.current.datasource = null;
        $scope.current.type = 'query';
        $scope.current.allFormat = 'Glob';
      }
    };

    $scope.update = function() {
      $scope.runQuery().then(function() {
        $scope.reset();
        $scope.editor.index = 0;
      });
    };

    $scope.reset = function() {
      $scope.currentIsNew = true;
      $scope.current = angular.copy(replacementDefaults);
    };

    $scope.typeChanged = function () {
      if ($scope.current.type === 'interval') {
        $scope.current.query = '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d';
      }
      if ($scope.current.type === 'query') {
        $scope.current.query = '';
      }
    };

    $scope.removeVariable = function(variable) {
      var index = _.indexOf($scope.variables, variable);
      $scope.variables.splice(index, 1);
    };

  });

});
