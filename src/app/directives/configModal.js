define([
  'angular'
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

            var tmpScope = scope.$new();
            tmpScope.panel = angular.copy(scope.panel);

            tmpScope.editSave = function(panel) {
              scope.panel = panel;
            };

            var panelModal = $modal({
              template: './app/partials/paneleditor.html',
              persist: true,
              show: false,
              scope: tmpScope,
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