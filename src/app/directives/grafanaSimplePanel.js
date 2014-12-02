define([
  'angular',
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('grafanaSimplePanel', function($compile) {
      var panelLoading = '<span ng-show="panelMeta.loading == true">' +
        '<span style="font-size:72px;font-weight:200">'+
          '<i class="icon-spinner icon-spin"></i> loading ...' +
        '</span>'+
      '</span>';

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

          function loadController(name) {
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
                $controllers.first().prepend(panelLoading);
                $scope.require([
                  'panels/'+nameAsPath+'/module'
                ], function() {
                  loadModule($module);
                });
              } else {
                loadModule($module);
              }
            });
          }

          $scope.$watch(attr.type, function (name) {
            loadController(name);
          });

        }
      };
    });

});
