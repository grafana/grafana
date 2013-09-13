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
        '<span class="editlink panelextra pointer" style="right:15px;top:0px"' +
          'bs-modal="\'app/partials/paneleditor.html\'" ng-show="panel.editable != false">' +
        '<span class="small">{{panel.type}}</span> <i class="icon-cog pointer"></i></span>' +
        '<h4 ng-show="panel.title">' +
          '{{panel.title}}' +
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