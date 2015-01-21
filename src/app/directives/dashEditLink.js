define([
  'angular',
  'jquery'
],
function (angular, $) {
  'use strict';

  var editViewMap = {
    'settings': 'app/partials/dasheditor.html',
    'annotations': 'app/features/annotations/partials/editor.html',
    'templating': 'app/partials/templating_editor.html',
  };

  angular
    .module('grafana.directives')
    .directive('dashEditorLink', function($timeout) {
      return {
        restrict: 'A',
        link: function(scope, elem, attrs) {
          var partial = attrs.dashEditorLink;

          elem.bind('click',function() {
            $timeout(function() {
              var editorScope = attrs.editorScope === 'isolated' ? null : scope;
              scope.appEvent('show-dash-editor', { src: partial, scope: editorScope });
            });
          });
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('dashEditorView', function($compile, $location) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          var editorScope;
          var lastEditor;

          function hideScrollbars(value) {
            if (value) {
              window.scrollTo(0,0);
              document.documentElement.style.overflow = 'hidden';  // firefox, chrome
              document.body.scroll = "no"; // ie only
            } else {
              document.documentElement.style.overflow = 'auto';
              document.body.scroll = "yes";
            }
          }

          function hideEditorPane() {
            hideScrollbars(false);
            if (editorScope) { editorScope.dismiss(); }
          }

          scope.onAppEvent('hide-dash-editor', hideEditorPane);

          scope.onAppEvent('show-dash-editor', function(evt, payload) {
            if (payload.editview) {
              payload.src = editViewMap[payload.editview];
            }

            if (lastEditor === payload.src) {
              hideEditorPane();
              return;
            }

            hideEditorPane();

            scope.exitFullscreen();

            lastEditor = payload.src;
            editorScope = payload.scope ? payload.scope.$new() : scope.$new();

            editorScope.dismiss = function() {
              editorScope.$destroy();
              elem.empty();
              lastEditor = null;
              editorScope = null;
              hideScrollbars(false);

              if (payload.editview) {
                var urlParams = $location.search();
                if (payload.editview === urlParams.editview) {
                  delete urlParams.editview;
                  $location.search(urlParams);
                }
              }
            };

            // hide page scrollbars while edit pane is visible
            hideScrollbars(true);

            var src = "'" + payload.src + "'";
            var view = $('<div class="dashboard-edit-view" ng-include="' + src + '"></div>');
            elem.append(view);
            $compile(elem.contents())(editorScope);
          });

        }
      };
    });

});
