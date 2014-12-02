define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InspectCtrl', function($scope) {
    var model = $scope.inspector;

    function getParametersFromQueryString(queryString) {
      var result = [];
      var parameters = queryString.split("&");
      for (var i = 0; i < parameters.length; i++) {
        var keyValue = parameters[i].split("=");
        if (keyValue[1].length > 0) {
          result.push({ key: keyValue[0], value: window.unescape(keyValue[1]) });
        }
      }
      return result;
    }

    $scope.init = function () {
      $scope.editor = { index: 0 };

      if (!model.error)  {
        return;
      }

      if (_.isString(model.error.data)) {
        $scope.response = model.error.data;
      }

      if (model.error.config && model.error.config.params) {
        $scope.request_parameters = _.map(model.error.config.params, function(value, key) {
          return { key: key, value: value};
        });
      }

      if (model.error.stack) {
        $scope.editor.index = 2;
        $scope.stack_trace = model.error.stack;
        $scope.message = model.error.message;
      }
      else if (model.error.config && model.error.config.data) {
        $scope.editor.index = 1;

        $scope.request_parameters = getParametersFromQueryString(model.error.config.data);

        if (model.error.data.indexOf('DOCTYPE') !== -1) {
          $scope.response_html = model.error.data;
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
