define([
  'angular',
  'app',
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('configModal', function($modal,$q) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          // create a new modal. Can't reuse one modal unforunately as the directive will not
          // re-render on show.
          elem.bind('click',function(){
            var panelModal = $modal({
              template: './app/partials/paneleditor.html',
              persist: true,
              show: false,
              scope: scope,
              keyboard: false
            });

            // and show it
            $q.when(panelModal).then(function(modalEl) {
              modalEl.modal('show');
            });
            scope.$apply();
          });
        }
      };
    });
});