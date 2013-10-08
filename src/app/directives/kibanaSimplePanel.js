define([
  'angular'
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('kibanaSimplePanel', function($compile) {
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