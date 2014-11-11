define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('popoverSrv', function($templateCache, $timeout, $q, $http, $compile) {

    this.getTemplate = function(url) {
      return $q.when($templateCache.get(url) || $http.get(url, {cache: true}));
    };

    this.show = function(options) {
      var popover = options.element.data('popover');
      if (popover) {
        popover.scope.$destroy();
        popover.destroy();
        return;
      }

      this.getTemplate(options.templateUrl).then(function(result) {
        var template = _.isString(result) ? result : result.data;

        options.element.popover({
          content: template,
          placement: 'bottom',
          html: true
        });

        popover = options.element.data('popover');
        popover.hasContent = function () {
          return template;
        };

        popover.toggle();
        popover.scope = options.scope;
        $compile(popover.$tip)(popover.scope);
      });
    };

  });

});
