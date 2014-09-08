define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function() {
    var self = this;

    this._regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    this._templateData = {};
    this._grafanaVariables = {};

    this.init = function(variables) {
      this.variables = variables;
      this.updateTemplateData(true);
    };

    this.updateTemplateData = function() {
      var data = {};

      _.each(this.variables, function(variable) {
        if (!variable.current || !variable.current.value) {
          return;
        }

        data[variable.name] = variable.current.value;
      });

      this._templateData = data;
    };

    this.setGrafanaVariable = function (name, value) {
      this._grafanaVariables[name] = value;
    };

    this.variableExists = function(expression) {
      this._regex.lastIndex = 0;
      var match = this._regex.exec(expression);
      return match && (self._templateData[match[1] || match[2]] !== void 0);
    };

    this.containsVariable = function(str, variableName) {
      return str.indexOf('$' + variableName) !== -1 || str.indexOf('[[' + variableName + ']]') !== -1;
    };

    this.highlightVariablesAsHtml = function(str) {
      if (!str || !_.isString(str)) { return str; }

      this._regex.lastIndex = 0;
      return str.replace(this._regex, function(match, g1, g2) {
        if (self._templateData[g1 || g2]) {
          return '<span class="template-variable">' + match + '</span>';
        }
        return match;
      });
    };

    this.replace = function(target) {
      if (!target) { return; }

      var value;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        value = self._templateData[g1 || g2];
        if (!value) { return match; }

        return self._grafanaVariables[value] || value;
      });
    };

  });

});
