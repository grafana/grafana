define([
  'angular',
  'lodash',
  'kbn',
  'store'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function($q, $routeParams) {

    this.init = function(templateParameters) {
      this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
      this.templateParameters = templateParameters;
      this.updateTemplateData(true);
    };

    this.updateTemplateData = function(initial) {
      var _templateData = {};
      _.each(this.templateParameters, function(templateParameter) {
        if (initial) {
          var urlValue = $routeParams[ templateParameter.name ];
          if (urlValue) {
            templateParameter.current = { text: urlValue, value: urlValue };
          }
        }
        if (!templateParameter.current || !templateParameter.current.value) {
          return;
        }
        _templateData[templateParameter.name] = templateParameter.current.value;
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
