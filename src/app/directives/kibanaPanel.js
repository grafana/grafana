define([
  'angular'
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('kibanaPanel', function($compile) {
      var container = '<div class="panelCont"></div>';

      var editorTemplate =

        '<div class="row-fluid panel-extra"><div class="panel-extra-container">' +

          '<span class="row-button extra" ng-show="panelMeta.loading == true">' +
            '<span>'+
              '<i class="icon-spinner icon-spin icon-large"></i>' +
            '</span>'+
          '</span>' +

          '<span ng-if="panelMeta.menuItems" class="dropdown" ng-show="panel.title">' +
            '<span class="panel-text panel-title pointer" bs-dropdown="panelMeta.menuItems" tabindex="1" ' +
            'data-drag=true data-jqyoui-options="{revert: \'invalid\',helper:\'clone\'}"'+
            ' jqyoui-draggable="'+
            '{'+
              'animate:false,'+
              'mutate:false,'+
              'index:{{$index}},'+
              'onStart:\'panelMoveStart\','+
              'onStop:\'panelMoveStop\''+
              '}"  ng-model="row.panels" ' +
              '>' +
              '{{panel.title}}' +
            '</span>' +
          '</span>'+

          '<span ng-if="!panelMeta.menuItems" config-modal class="panel-text panel-title pointer" ng-show="panel.title">' +
            '{{panel.title}}' +
          '</span>'+

        '</div></div>';
      return {
        restrict: 'E',
        link: function($scope, elem, attr) {
          // once we have the template, scan it for controllers and
          // load the module.js if we have any
          var newScope = $scope.$new();

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
              'text!panels/'+nameAsPath+'/module.html',
              'text!panels/'+nameAsPath+'/editor.html'
            ], function ($, moduleTemplate) {
              var $module = $(moduleTemplate);
              // top level controllers
              var $controllers = $module.filter('ngcontroller, [ng-controller], .ng-controller');
              // add child controllers
              $controllers = $controllers.add($module.find('ngcontroller, [ng-controller], .ng-controller'));

              if ($controllers.length) {
                $controllers.first().prepend(editorTemplate);
                $scope.require([
                  'panels/'+nameAsPath+'/module'
                ], function() {
                  loadModule($module);
                });
              } else {
                loadModule($module);
              }
            });
          });
        }
      };
    });

});