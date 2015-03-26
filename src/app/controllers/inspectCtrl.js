define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InspectCtrl', function($scope) {
    var model = $scope.inspector;

    $scope.init = function () {
      $scope.editor = { index: 0 };

      if (!model.errors || model.errors.length === 0)  {
        return;
      }

      $scope.responses = [];
      _.each(model.errors, function(error) {
        if (_.isString(error.data)) {
          // add response data
          $scope.responses.push(error.data);
        }

        if (error.config && error.config.params) {
          var requestParameters = _.map(error.config.params, function(value, key) {
            return {key: key, value: value};
          });

          error.requestParameters = requestParameters;
        }
      });

      // all errors will share same stack, as they all come from same query call
      var firstError = model.errors[0];
      var stackTrace = firstError.stack;
      if (stackTrace) {
        $scope.editor.index = 2;
        $scope.stack_trace = stackTrace;
      }

      // in order to avoid opening multiple iframes which can hurt performance, we will only
      // display from first error in list
      else if (firstError.config && firstError.config.data) {
        $scope.editor.index = 1;

        if (firstError.data.indexOf('DOCTYPE') !== -1) {
          $scope.response_html = firstError.data;
        }
      }
    };

  });

  angular
    .module('grafana.directives')
    .directive('iframeContent', function($parse) {
      return {
        restrict: 'A',
        link: function($scope, elem, attrs) {
          var getter = $parse(attrs.iframeContent), value = getter($scope);

          $scope.$on("$destroy",function() {
            elem.remove();
          });

          var iframe = document.createElement('iframe');
          iframe.width = '100%';
          iframe.height = '400px';
          iframe.style.border = 'none';
          iframe.src = 'about:blank';
          elem.append(iframe);

          iframe.contentWindow.document.open('text/html', 'replace');
          iframe.contentWindow.document.write(value);
          iframe.contentWindow.document.close();
        }
      };
    });

});
