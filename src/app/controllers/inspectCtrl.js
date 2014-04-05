define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('InspectCtrl', function($scope) {

    $scope.init = function () {

      if ($scope.inspector_info) {
        $scope.init_model($scope.inspector_info);
      }

    };

    $scope.init_model = function(info) {
      if (info.error) {
        console.log(info.error);
        if (info.error.config && info.error.config.data) {
          $scope.request_parameters = info.error.config.data.split('&');
        }

        if (info.error.data) {
          if (info.error.data.indexOf('DOCTYPE') !== -1) {
            $scope.response_html = info.error.data;
          }
        }
      }
    };

  });

  angular
    .module('kibana.directives')
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