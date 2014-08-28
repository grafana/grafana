define([
  'angular',
  'lodash',
  'kbn',
  'config'
],
function (angular, _, kbn, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function($q, $routeParams) {
    var self = this;

    this.init = function(variables) {
      this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
      this.variables = variables;
      this.updateTemplateData(true);
    };

    this.updateTemplateData = function(initial) {
      var _templateData = {};
      _.each(this.variables, function(variable) {
        if (initial) {
          var urlValue = $routeParams[ variable.name ];
          if (urlValue) {
            variable.current = { text: urlValue, value: urlValue };
          }
        }
        if (!variable.current || !variable.current.value) {
          return;
        }

        _templateData[variable.name] = variable.current.value;

      });
      this._templateData = _templateData;
    };

    this.replace = function(target) {
      if (!target || target.indexOf('[[') === -1) {
        return target;
      }

      return _.template(target, this._templateData, this.templateSettings);
    };

  });

});
