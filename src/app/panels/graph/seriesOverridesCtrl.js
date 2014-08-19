define([
  'angular',
  'app',
  'lodash',
], function(angular, app, _) {
  'use strict';

  var module = angular.module('grafana.panels.graph', []);
  app.useModule(module);

  module.controller('SeriesOverridesCtrl', function($scope) {
    $scope.overrideMenu = [];
    $scope.currentOverrides = [];
    $scope.override = $scope.override || {};

    $scope.addOverrideOption = function(name, propertyName, values) {
      var option = {};
      option.text = name;
      option.propertyName = propertyName;
      option.index = $scope.overrideMenu.length;
      option.values = values;

      option.submenu = _.map(values, function(value, index) {
        return {
          text: String(value),
          click: 'setOverride(' + option.index + ',' + index + ')'
        };
      });

      $scope.overrideMenu.push(option);
    };

    $scope.setOverride = function(optionIndex, valueIndex) {
      var option = $scope.overrideMenu[optionIndex];
      var value = option.values[valueIndex];
      $scope.override[option.propertyName] = value;
      $scope.updateCurrentOverrides();
    };

    $scope.removeOverride = function(option) {
      delete $scope.override[option.propertyName];
      $scope.updateCurrentOverrides();
    };

    $scope.updateCurrentOverrides = function() {
      $scope.currentOverrides = [];
      _.each($scope.overrideMenu, function(option) {
        if (!_.isUndefined($scope.override[option.propertyName])) {
          $scope.currentOverrides.push({
            name: option.text,
            propertyName: option.propertyName,
            value: String($scope.override[option.propertyName])
          });
        }
      });
    };

    $scope.addOverrideOption('Bars', 'bars', [true, false]);
    $scope.addOverrideOption('Lines', 'lines', [true, false]);
    $scope.addOverrideOption('Points', 'points', [true, false]);
    $scope.addOverrideOption('Line fill', 'fill', [1,2,3,4,5,6,7,8]);
    $scope.updateCurrentOverrides();

  });

});
