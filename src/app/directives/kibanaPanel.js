define([
  'angular'
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('kibanaPanel', function($compile) {
      var editorTemplate =
        '<i class="icon-spinner small icon-spin icon-large panel-loading"' +
          'ng-show="panelMeta.loading == true && !panel.title"></i>' +

        '<span class="panelextra">' +

          '<span ng-repeat="task in panelMeta.modals" ng-show="task.show">' +
            '<span bs-modal="task.partial" class="pointer"><i ' +
              'bs-tooltip="task.description" ng-class="task.icon" class="pointer"></i></span>'+
          ' / </span>' +

          '<span ng-show="panel.editable != false">' +
            '<span bs-modal="\'app/partials/paneleditor.html\'" class="pointer">'+
            '<i class="icon-cog pointer" bs-tooltip="\'Configure\'"></i></span>'+
          ' / </span>' +

          '<span ng-show="panel.editable != false">' +
            '<span confirm-click="row.panels = _.without(row.panels,panel)" '+
            'confirmation="Are you sure you want to remove this {{panel.type}} panel?" class="pointer">'+
            '<i class="icon-remove-sign pointer" bs-tooltip="\'Remove\'"></i></span>'+
          ' / </span>' +

          '<span class="small strong">{{panel.type}}</span> ' +
        '</span>' +

        '<h4 ng-show="panel.title" style="margin:0px;">' +
          '{{panel.title}}&nbsp' +
          '<i class="icon-spinner smaller icon-spin icon-large"' +
            'ng-show="panelMeta.loading == true && panel.title"></i>' +
        '</h4>';
      return {
        restrict: 'E',
        link: function($scope, elem, attr) {
          // once we have the template, scan it for controllers and
          // load the module.js if we have any

          // compile the module and uncloack. We're done
          function loadModule($module) {
            $module.appendTo(elem);
            /* jshint indent:false */
            $compile(elem.contents())($scope);
            elem.removeClass("ng-cloak");
          }

          $scope.$watch(attr.type, function (name) {
            elem.addClass("ng-cloak");
            // load the panels module file, then render it in the dom.
            $scope.require([
              'jquery',
              'text!panels/'+name+'/module.html'
            ], function ($, moduleTemplate) {
              var $module = $(moduleTemplate);
              // top level controllers
              var $controllers = $module.filter('ngcontroller, [ng-controller], .ng-controller');
              // add child controllers
              $controllers = $controllers.add($module.find('ngcontroller, [ng-controller], .ng-controller'));

              if ($controllers.length) {
                $controllers.first().prepend(editorTemplate);
                $scope.require([
                  'panels/'+name+'/module'
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