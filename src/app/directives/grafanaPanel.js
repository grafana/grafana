define([
  'angular',
  'jquery',
  'config',
  './panelMenu',
],
function (angular, $, config) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('grafanaPanel', function($compile, $parse) {

      var container = '<div class="panel-container"></div>';
      var content = '<div class="panel-content"></div>';

      var panelHeader =
      '<div class="panel-header">'+
          '<span class="alert-error panel-error small pointer"' +
                'config-modal="app/partials/inspector.html" ng-if="panelMeta.error">' +
            '<span data-placement="right" bs-tooltip="panelMeta.error">' +
            '<i class="icon-exclamation-sign"></i><span class="panel-error-arrow"></span>' +
            '</span>' +
          '</span>' +

          '<span class="panel-loading" ng-show="panelMeta.loading">' +
            '<i class="icon-spinner icon-spin icon-large"></i>' +
          '</span>' +

          '<div class="panel-title-container drag-handle" panel-menu></div>' +
        '</div>'+
      '</div>';

      return {
        restrict: 'E',
        link: function($scope, elem, attr) {
          var getter = $parse(attr.type), panelType = getter($scope);
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

            var panelCtrlElem = $(elem.children()[0]);
            var panelCtrlScope = panelCtrlElem.data().$scope;

            panelCtrlScope.$watchGroup(['fullscreen', 'panel.height', 'row.height'], function() {
              panelCtrlElem.css({ minHeight: panelCtrlScope.panel.height || panelCtrlScope.row.height });
              panelCtrlElem.toggleClass('panel-fullscreen', panelCtrlScope.fullscreen ? true : false);
            });
          }

          newScope.$on('$destroy',function() {
            elem.unbind();
            elem.remove();
          });

          elem.addClass('ng-cloak');

          var panelPath = config.panels[panelType].path;

          $scope.require([
            'jquery',
            'text!'+panelPath+'/module.html',
            panelPath + "/module",
          ], function ($, moduleTemplate) {
            var $module = $(moduleTemplate);
            $module.prepend(panelHeader);
            $module.first().find('.panel-header').nextAll().wrapAll(content);
            loadModule($module);
          });

        }
      };
    });

});
