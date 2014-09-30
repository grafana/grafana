define([
  'angular',
  'jquery',
  'lodash',
],
function (angular, $, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelMenu', function($compile) {
      var linkTemplate = '<a class="panel-title">{{panel.title | interpolateTemplateVars}}</a>';
      var moveAttributes = ' data-drag=true data-jqyoui-options="kbnJqUiDraggableOptions"'+
              ' jqyoui-draggable="{'+
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
          template += '<a class="panel-menu-link" ';
          if (item.click) { template += ' ng-click="' + item.click + '"'; }
          if (item.editorLink) { template += ' dash-editor-link="' + item.editorLink + '"'; }
          template += '>';
          template += item.text + '</a>';
        });

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
          var menuWidth = $scope.panelMeta.menu.length === 5 ? 246 : 201;
          var menuScope = null;
          var timeout = null;
          var $menu = null;

          elem.append($link);

          function dismiss(time) {
            clearTimeout(timeout);
            timeout = null;

            if (time) {
              timeout = setTimeout(dismiss, time);
              return;
            }

            // if hovering or draging pospone close
            if ($menu.is(':hover') || $scope.dashboard.$$panelDragging) {
              dismiss(2500);
              return;
            }

            if (menuScope) {
              $menu.unbind();
              $menu.remove();
              menuScope.$destroy();
              menuScope = null;
              $menu = null;
              $panelContainer.removeClass('panel-highlight');
            }
          }

          var showMenu = function() {
            if ($menu) {
              dismiss();
              return;
            }

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

            var menuTemplate = createMenuTemplate($scope);
            $menu = $(menuTemplate);
            $menu.css('left', menuLeftPos);
            $menu.mouseleave(function() {
              dismiss(1000);
            });

            menuScope = $scope.$new();

            $('.panel-menu').remove();
            elem.append($menu);
            $scope.$apply(function() {
              $compile($menu.contents())(menuScope);
            });

            $(".panel-container").removeClass('panel-highlight');
            $panelContainer.toggleClass('panel-highlight');

            dismiss(2500);
          };

          elem.click(showMenu);
          $compile(elem.contents())($scope);
        }
      };
    });
});
