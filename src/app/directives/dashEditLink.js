define([
  'angular',
  'jquery'
],
function (angular, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('dashEditorLink', function($timeout) {
      return {
        restrict: 'A',
        link: function(scope, elem, attrs) {
          var partial = attrs.dashEditorLink;

          elem.bind('click',function() {
            $timeout(function() {
              scope.emitAppEvent('show-dash-editor', { src: partial, scope: scope });
            });
          });
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('dashEditorView', function($compile) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          var editorScope;
          var lastEditor;

          scope.onAppEvent('hide-dash-editor', function() {
            if (editorScope) {
              editorScope.dismiss();
            }
          });

          scope.onAppEvent('show-dash-editor', function(evt, payload) {
            if (lastEditor === payload.src) {
              editorScope.dismiss();
              return;
            }

            if (editorScope) {
              editorScope.dismiss();
            }

            scope.exitFullscreen();

            lastEditor = payload.src;
            editorScope = payload.scope ? payload.scope.$new() : scope.$new();
            editorScope.dismiss = function() {
              editorScope.$destroy();
              elem.empty();
              lastEditor = null;
              editorScope = null;
            };

            var src = "'" + payload.src + "'";
            var view = $('<div class="dashboard-edit-view" ng-include="' + src + '"></div>');
            elem.append(view);
            $compile(elem.contents())(editorScope);
          });

        }
      };
    });

});
