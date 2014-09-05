define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function($q, $routeParams) {
    var self = this;

    this.init = function(variables) {
      this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
      this.variables = variables;
      this.regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
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

    this.setGrafanaVariable = function(name, value) {
      this._templateData[name] = value;
    };

    this.variableExists = function(expression) {
      this.regex.lastIndex = 0;
      var match = this.regex.exec(expression);
      return match && (self._templateData[match[1] || match[2]] !== void 0);
    };

    this.highlightVariablesAsHtml = function(str) {
      if (!str || !_.isString(str)) { return str; }

      this.regex.lastIndex = 0;
      return str.replace(this.regex, function(match, g1, g2) {
        if (self._templateData[g1 || g2]) {
          return '<span class="template-variable">' + match + '</span>';
        }
      });
    };

    this.replace = function(target) {
      if (!target) { return; }

      this.regex.lastIndex = 0;
      return target.replace(this.regex, function(match, g1, g2) {
        return self._templateData[g1 || g2] || match;
      });
    };

  });

});
