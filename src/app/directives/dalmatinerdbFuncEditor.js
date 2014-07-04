define([
  'angular',
  'underscore',
  'jquery',
], function (angular, _, $) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('dalmatinerdbFuncEditor', function($compile) {

      var funcSpanTemplate = '<a gf-dropdown="functionMenu" class="dropdown-toggle" ' +
          'data-toggle="dropdown">{{aggr.name}}</a><span>(</span>';

      var paramTemplate = '<input type="text" style="display:none"' +
          ' class="input-mini grafana-function-param-input"></input>';

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);

          $scope.functionMenu = _.map($scope.functions, function(func) {
            return {
              text: func,
              click: "changeFunction('" + func + "');"
            };
          });

          function clickFuncParam() {
            /*jshint validthis:true */

            var $link = $(this);
            var $input = $link.next();

            $input.val($scope.aggr.value);
            $input.css('width', ($link.width() + 16) + 'px');

            $link.hide();
            $input.show();
            $input.focus();
            $input.select();

          }

          function inputBlur() {
            /*jshint validthis:true */

            var $input = $(this);
            var $link = $input.prev();

            if ($input.val() !== '') {
              $link.text($input.val());

              $scope.aggr.val = $input.val();
              $scope.$apply($scope.get_data);
            }

            $input.hide();
            $link.show();
          }

          function inputKeyPress(e) {
            /*jshint validthis:true */

            if(e.which === 13) {
              inputBlur.call(this);
            }
          }

          function inputKeyDown() {
            /*jshint validthis:true */
            this.style.width = (3 + this.value.length) * 8 + 'px';
          }

          function addElementsAndCompile() {
            $funcLink.appendTo(elem);
            if ($scope.aggr.val) {
              var $paramLink = $('<a ng-click="" class="graphite-func-param-link">' + $scope.aggr.val + '</a>');
              var $input = $(paramTemplate);
              $paramLink.appendTo(elem);
              $input.appendTo(elem);
              $input.blur(inputBlur);
              $input.keyup(inputKeyDown);
              $input.keypress(inputKeyPress);
              $paramLink.click(clickFuncParam);
            }
            $('<span>)</span>').appendTo(elem);
            $compile(elem.contents())($scope);
          }
          addElementsAndCompile();
        }
      };
    });
});
