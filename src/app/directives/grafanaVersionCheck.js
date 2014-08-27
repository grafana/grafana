define([
  'angular'
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('grafanaVersionCheck', function($http, grafanaVersion) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          if (grafanaVersion[0] === '@') {
            return;
          }

          $http({ method: 'GET', url: 'https://grafanarel.s3.amazonaws.com/latest.json' })
            .then(function(response) {
              if (!response.data || !response.data.version) {
                return;
              }

              if (grafanaVersion !== response.data.version) {
                elem.append('<i class="icon-info-sign"></i> ' +
                            '<a href="http://grafana.org/download" target="_blank"> ' +
                                'New version available: ' + response.data.version +
                            '</a>');
              }
            });
        }
      };
    });
});
