define([
  'angular',
  'jquery',
  'underscore'
],
function (angular, $, _) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('kibanaPanel', function($compile, $timeout, $rootScope) {

      var container = '<div class="panel-container"></div>';
      var content = '<div class="panel-content"></div>';

      var panelHeader =
      '<div class="panel-header">'+
        '<div class="row-fluid">' +
          '<div class="span12 alert-error panel-error" ng-hide="!panel.error">' +
            '<a class="close" ng-click="panel.error=false">&times;</a>' +
            '<i class="icon-exclamation-sign"></i> <strong>Oops!</strong> {{panel.error}}' +
          '</div>' +
        '</div>\n' +

        '<div class="row-fluid panel-extra">' +
          '<div class="panel-extra-container">' +

            '<span class="panel-loading" ng-show="panelMeta.loading == true">' +
              '<i class="icon-spinner icon-spin icon-large"></i>' +
            '</span>' +

            '<span class="dropdown">' +
              '<span class="panel-text panel-title pointer" gf-dropdown="panelMeta.menu" tabindex="1" ' +
              'data-drag=true data-jqyoui-options="kbnJqUiDraggableOptions"'+
              ' jqyoui-draggable="'+
              '{'+
                'animate:false,'+
                'mutate:false,'+
                'index:{{$index}},'+
                'onStart:\'panelMoveStart\','+
                'onStop:\'panelMoveStop\''+
                '}"  ng-model="row.panels" ' +
                '>' +
                '{{panel.title || "No title"}}' +
              '</span>' +
            '</span>'+

          '</div>'+
        '</div>\n'+
      '</div>';

      return {
        restrict: 'E',
        link: function($scope, elem, attr) {
          // once we have the template, scan it for controllers and
          // load the module.js if we have any
          var newScope = $scope.$new();

          $scope.kbnJqUiDraggableOptions = {
            revert: 'invalid',
            helper: function() {
              return $('<div style="width:200px;height:100px;background: rgba(100,100,100,0.50);"/>');
            },
            placeholder: 'keep'
          };

          // compile the module and uncloack. We're done
          function loadModule($module) {
            $module.appendTo(elem);
            elem.wrap(container);
            /* jshint indent:false */
            $compile(elem.contents())(newScope);
            elem.removeClass("ng-cloak");
          }

          newScope.$on('$destroy',function(){
            elem.unbind();
            elem.remove();
          });

          $scope.$watch(attr.type, function (name) {
            elem.addClass("ng-cloak");
            // load the panels module file, then render it in the dom.
            var nameAsPath = name.replace(".", "/");
            $scope.require([
              'jquery',
              'text!panels/'+nameAsPath+'/module.html'
            ], function ($, moduleTemplate) {
              var $module = $(moduleTemplate);
              // top level controllers
              var $controllers = $module.filter('ngcontroller, [ng-controller], .ng-controller');
              // add child controllers
              $controllers = $controllers.add($module.find('ngcontroller, [ng-controller], .ng-controller'));

              if ($controllers.length) {
                $controllers.first().prepend(panelHeader);
                $controllers.first().find('.panel-header').nextAll().wrapAll(content);

                $scope.require(['panels/' + nameAsPath + '/module'], function() {
                  loadModule($module);
                });
              } else {
                loadModule($module);
              }
            });
          });


          /*
          /* Panel base functionality
          /* */
          newScope.initPanel = function(scope) {

            scope.updateColumnSpan = function(span) {
              scope.panel.span = span;

              $timeout(function() {
                scope.$emit('render');
              });
            };

            function enterFullscreenMode(options) {
              var docHeight = $(window).height();
              var editHeight = Math.floor(docHeight * 0.3);
              var fullscreenHeight = Math.floor(docHeight * 0.7);
              var oldTimeRange = scope.range;

              scope.height = options.edit ? editHeight : fullscreenHeight;
              scope.editMode = options.edit;

              if (!scope.fullscreen) {
                var closeEditMode = $rootScope.$on('panel-fullscreen-exit', function() {
                  scope.editMode = false;
                  scope.fullscreen = false;
                  delete scope.height;

                  closeEditMode();

                  $timeout(function() {
                    if (oldTimeRange !== $scope.range) {
                      scope.dashboard.refresh();
                    }
                    else {
                      scope.$emit('render');
                    }
                  });
                });
              }

              $(window).scrollTop(0);

              scope.fullscreen = true;

              $rootScope.$emit('panel-fullscreen-enter');

              $timeout(function() {
                scope.$emit('render');
              });
            }

            scope.toggleFullscreenEdit = function() {
              if (scope.editMode) {
                $rootScope.$emit('panel-fullscreen-exit');
                return;
              }

              enterFullscreenMode({edit: true});
            };

            $scope.toggleFullscreen = function() {
              if (scope.fullscreen && !scope.editMode) {
                $rootScope.$emit('panel-fullscreen-exit');
                return;
              }

              enterFullscreenMode({ edit: false });
            };

            var menu = [
              {
                text: 'Edit',
                configModal: "app/partials/paneleditor.html",
                condition: !scope.panelMeta.fullscreenEdit
              },
              {
                text: 'Edit',
                click: "toggleFullscreenEdit()",
                condition: scope.panelMeta.fullscreenEdit
              },
              {
                text: "Fullscreen",
                click: 'toggleFullscreen()',
                condition: scope.panelMeta.fullscreenView
              },
              {
                text: 'Duplicate',
                click: 'duplicatePanel(panel)',
                condition: true
              },
              {
                text: 'Span',
                submenu: [
                  { text: '1', click: 'updateColumnSpan(1)' },
                  { text: '2', click: 'updateColumnSpan(2)' },
                  { text: '3', click: 'updateColumnSpan(3)' },
                  { text: '4', click: 'updateColumnSpan(4)' },
                  { text: '5', click: 'updateColumnSpan(5)' },
                  { text: '6', click: 'updateColumnSpan(6)' },
                  { text: '7', click: 'updateColumnSpan(7)' },
                  { text: '8', click: 'updateColumnSpan(8)' },
                  { text: '9', click: 'updateColumnSpan(9)' },
                  { text: '10', click: 'updateColumnSpan(10)' },
                  { text: '11', click: 'updateColumnSpan(11)' },
                  { text: '12', click: 'updateColumnSpan(12)' },
                ],
                condition: true
              },
              {
                text: 'Remove',
                click: 'remove_panel_from_row(row, panel)',
                condition: true
              }
            ];

            scope.panelMeta.menu = _.where(menu, { condition: true });
          };
        }
      };
    });

});