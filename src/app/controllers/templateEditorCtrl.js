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
      $scope.templateParameters = templateSrv.templateParameters;
      $scope.reset();

      _.each($scope.templateParameters, function(param) {
        if (param.datasource === void 0) {
          param.datasource = null;
          param.type = 'query';
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
      $scope.templateParameters.push($scope.current);
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.runQuery = function() {
      templateValuesSrv.updateValuesFor($scope.current);
    };

    $scope.edit = function(param) {
      $scope.current = param;
      $scope.currentIsNew = false;
      $scope.currentDatasource = _.findWhere($scope.datasources, { name: param.datasource });

      if (!$scope.currentDatasource) {
        $scope.currentDatasource = $scope.datasources[0];
      }

      $scope.editor.index = 2;
    };

    $scope.update = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.reset = function() {
      $scope.currentIsNew = true;
      $scope.current = angular.copy(replacementDefaults);
    };

    $scope.typeChanged = function () {
      if ($scope.current.type === 'time period') {
        $scope.current.options = ['auto', '1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d'];
        $scope.current.auto_count = 10;
      }
    };

    $scope.removeTemplateParam = function(templateParam) {
      var index = _.indexOf($scope.templateParameters, templateParam);
      $scope.templateParameters.splice(index, 1);
    };

  });

});
