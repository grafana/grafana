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


          '<span class="extra row-button" ng-show="panel.editable != false">' +
            '<span confirm-click="row.panels = _.without(row.panels,panel)" '+
            'confirmation="Are you sure you want to remove this {{panel.type}} panel?" class="pointer">'+
            '<i class="icon-remove pointer" bs-tooltip="\'Remove\'"></i></span>'+
          '</span>' +

          '<span class="extra row-button" ng-hide="panel.draggable == false">' +
            '<span class="pointer" bs-tooltip="\'Drag here to move\'"' +
            'data-drag=true data-jqyoui-options="{revert: \'invalid\',helper:\'clone\'}"'+
            ' jqyoui-draggable="'+
            '{'+
              'animate:false,'+
              'mutate:false,'+
              'index:{{$index}},'+
              'onStart:\'panelMoveStart\','+
              'onStop:\'panelMoveStop\''+
              '}"  ng-model="row.panels"><i class="icon-move"></i></span>'+
          '</span>' +
          '<span class="extra row-button" ng-show="panel.draggable == false">' +
            '<span class="row-text">{{panel.type}}</span>'+
          '</span>' +

          '<span class="row-button extra" ng-show="panel.editable != false">' +
            '<span bs-modal="\'app/partials/paneleditor.html\'" class="pointer">'+
            '<i class="icon-cog pointer" bs-tooltip="\'Configure\'"></i></span>'+
          '</span>' +

          '<span ng-repeat="task in panelMeta.modals" class="row-button extra" ng-show="task.show">' +
            '<span bs-modal="task.partial" class="pointer"><i ' +
              'bs-tooltip="task.description" ng-class="task.icon" class="pointer"></i></span>'+
          '</span>' +

          '<span class="row-button extra" ng-show="panelMeta.loading == true">' +
            '<span>'+
              '<i class="icon-spinner icon-spin icon-large"></i>' +
            '</span>'+
          '</span>' +

          '<span class="row-button row-text panel-title" ng-show="panel.title">' +
            '{{panel.title}}' +
          '</span>'+

        '</div></div>';
      return {
        restrict: 'E',
        link: function($scope, elem, attr) {
          // once we have the template, scan it for controllers and
          // load the module.js if we have any

          // compile the module and uncloack. We're done
          function loadModule($module) {
            $module.appendTo(elem);
            elem.wrap(container);
            /* jshint indent:false */
            $compile(elem.contents())($scope);
            elem.removeClass("ng-cloak");
          }

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