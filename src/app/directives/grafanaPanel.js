define([
  'angular',
  'jquery',
  'lodash',
],
function (angular, $, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelTitle', function($compile) {
      var linkTemplate = '<a class="pointer panel-title">{{panel.title || interpolateTemplateVars}}</a>';
      var moveAttributes = ' data-drag=true data-jqyoui-options="kbnJqUiDraggableOptions"'+
              ' jqyoui-draggable="'+
              '{'+
                'animate:false,'+
                'mutate:false,'+
                'index:{{$index}},'+
                'onStart:\'panelMoveStart\','+
                'onStop:\'panelMoveStop\''+
                '}"  ng-model="panel" ';

      function createMenuTemplate($scope) {
        var template = '<div class="panel-menu small">';
        template += '<div class="panel-menu-inner">';
        template += '<div class="panel-menu-row">';
        template += '<a class="panel-menu-icon pull-left" ng-click="updateColumnSpan(-1)"><i class="icon-minus"></i></a>';
        template += '<a class="panel-menu-icon pull-left" ng-click="updateColumnSpan(1)"><i class="icon-plus"></i></a>';
        template += '<a class="panel-menu-icon pull-right" ng-click="remove_panel_from_row(row, panel)"><i class="icon-remove"></i></a>';
        template += '<a class="panel-menu-icon pull-right" ' + moveAttributes + '><i class="icon-move"></i></a>';
        template += '<div class="clearfix"></div>';
        template += '</div>';

        template += '<div class="panel-menu-row">';

        _.each($scope.panelMeta.menu, function(item) {
          template += '<a class="panel-menu-link pull-left" ';
          if (item.click) { template += ' ng-click="' + item.click + '"'; }
          template += '>';
          template += item.text + '</a>';
        });

        template += '<a class="panel-menu-link pull-left">share</a>';

        template += '</div>';
        template += '</div>';
        template += '</div>';
        return template;
      }

      return {
        restrict: 'A',
        link: function($scope, elem) {
          var $link = $(linkTemplate);
          var $panelContainer = elem.parents(".panel-container");
          var menuTemplate = createMenuTemplate($scope);
          var menuWidth = 277;
          var menuScope = null;
          var timeout = null;

          elem.append($link);

          var dismiss = function() {
            $('.panel-menu').remove();

            if (menuScope) {
              menuScope.$destroy();
              menuScope = null;
              $panelContainer.removeClass('panel-highlight');
            }
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            return;
          };

          $link.click(function() {
            if (menuScope) {
              dismiss();
              return;
            }

            dismiss();

            var windowWidth = $(window).width();
            var panelLeftPos = $(elem).offset().left;
            var panelWidth = $(elem).width();
            var menuLeftPos = (panelWidth / 2) - (menuWidth/2);
            var stickingOut = panelLeftPos + menuLeftPos + menuWidth - windowWidth;
            if (stickingOut > 0) {
              menuLeftPos -= stickingOut + 10;
            }
            if (panelLeftPos + menuLeftPos < 0) {
              menuLeftPos = 0;
            }

            var $menu = $(menuTemplate);
            $menu.css('left', menuLeftPos);

            menuScope = $scope.$new();

            elem.append($menu);
            $scope.$apply(function() {
              $compile($menu.contents())(menuScope);
            });


            $(".panel-container").removeClass('panel-highlight');
            $panelContainer.toggleClass('panel-highlight');

            //timeout = setTimeout(dismiss, 8000);
          });

          $compile(elem.contents())($scope);
        }
      };

    });

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

          '<div panel-title ' + '></div>' +
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

          $scope.require([
            'jquery',
            'text!panels/'+panelType+'/module.html',
            'panels/' + panelType + "/module",
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
