define([
  'angular',
  'underscore',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('graphiteFuncEditor', function($compile) {

      var funcSpanTemplate = '<a ng-click="">{{func.def.name}}</a><span>(</span>';
      var paramTemplate = '<input type="text" style="display:none"' +
                          ' class="input-mini grafana-function-param-input"></input>';

      var clickFuncParam = function(func, paramIndex) {
        var $link = $(this);
        var $input = $link.next();

        $input.val(func.params[paramIndex]);
        $input.css('width', ($link.width() + 16) + 'px');

        $link.hide();
        $input.show();
        $input.focus();
        $input.select();

        var typeahead = $input.data('typeahead');
        if (typeahead) {
          $input.val('');
          typeahead.lookup();
        }
      };

      var inputBlur = function(scope, func, paramIndex) {
        var $input = $(this);
        var $link = $input.prev();

        if ($input.val() !== '') {
          $link.text($input.val());

          if (func.updateParam($input.val(), paramIndex)) {
            scope.$apply(function() {
              scope.targetChanged();
            });
          }
        }

        $input.hide();
        $link.show();
      };

      var inputKeyPress = function(scope, func, paramIndex, e) {
        if(e.which === 13) {
          inputBlur.call(this, scope, func, paramIndex);
        }
      };

      var inputKeyDown = function() {
        this.style.width = (3 + this.value.length) * 8 + 'px';
      };

      var addTypeahead = function($input, scope, func, paramIndex) {
        $input.attr('data-provide', 'typeahead');

        var options = func.def.params[paramIndex].options;
        if (func.def.params[paramIndex].type === 'int') {
          options = _.map(options, function(val) { return val.toString(); } );
        }

        $input.typeahead({
          source: options,
          minLength: 0,
          items: 20,
          updater: function (value) {
            setTimeout(function() {
              inputBlur.call($input[0], scope, func, paramIndex);
            }, 0);
            return value;
          }
        });

        var typeahead = $input.data('typeahead');
        typeahead.lookup = function () {
          this.query = this.$element.val() || '';
          return this.process(this.source);
        };

      };

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);

          $funcLink.appendTo(elem);

          _.each($scope.func.def.params, function(param, index) {
            var $paramLink = $('<a ng-click="">' + $scope.func.params[index] + '</a>');
            var $input = $(paramTemplate);

            $paramLink.appendTo(elem);
            $input.appendTo(elem);

            $input.blur(_.partial(inputBlur, $scope, $scope.func, index));
            $input.keyup(inputKeyDown);
            $input.keypress(_.partial(inputKeyPress, $scope, $scope.func, index));
            $paramLink.click(_.partial(clickFuncParam, $scope.func, index));

            if (index !== $scope.func.def.params.length - 1) {
              $('<span>, </span>').appendTo(elem);
            }

            if ($scope.func.def.params[index].options) {
              addTypeahead($input, $scope, $scope.func, index);
            }

          });

          $('<span>)</span>').appendTo(elem);

          $compile(elem.contents())($scope);
        }
      };

    });


});