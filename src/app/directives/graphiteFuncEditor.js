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

      var funcControlsTemplate =
         '<span class="graphite-func-controls">' +
           '<span class="pointer icon-arrow-left"></span>' +
           '<span class="pointer icon-info-sign"></span>' +
           '<span class="pointer icon-remove" ></span>' +
           '<span class="pointer icon-arrow-right"></span>' +
         '</span>';

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);
          var $funcControls = $(funcControlsTemplate);
          var func = $scope.func;
          var funcDef = func.def;

          function clickFuncParam(paramIndex) {
            /*jshint validthis:true */

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
          }

          function inputBlur(paramIndex) {
            /*jshint validthis:true */

            var $input = $(this);
            var $link = $input.prev();

            if ($input.val() !== '') {
              $link.text($input.val());

              if (func.updateParam($input.val(), paramIndex)) {
                $scope.$apply(function() {
                  $scope.targetChanged();
                });
              }
            }

            $input.hide();
            $link.show();
          }

          function inputKeyPress(paramIndex, e) {
            /*jshint validthis:true */

            if(e.which === 13) {
              inputBlur.call(this, paramIndex);
            }
          }

          function inputKeyDown() {
            /*jshint validthis:true */
            this.style.width = (3 + this.value.length) * 8 + 'px';
          }

          function addTypeahead($input, paramIndex) {
            $input.attr('data-provide', 'typeahead');

            var options = funcDef.params[paramIndex].options;
            if (funcDef.params[paramIndex].type === 'int') {
              options = _.map(options, function(val) { return val.toString(); } );
            }

            $input.typeahead({
              source: options,
              minLength: 0,
              items: 20,
              updater: function (value) {
                setTimeout(function() {
                  inputBlur.call($input[0], paramIndex);
                }, 0);
                return value;
              }
            });

            var typeahead = $input.data('typeahead');
            typeahead.lookup = function () {
              this.query = this.$element.val() || '';
              return this.process(this.source);
            };
          }

          function getPosition() {
            var el = elem[0];
            var pos = {};
            if (typeof el.getBoundingClientRect === 'function') {
              pos = el.getBoundingClientRect();
            }
            else {
              pos = { width: el.offsetWidth, height: el.offsetHeight };
            }

            return $.extend(pos, elem.offset());
          }

          function toggleFuncControls() {
            var targetDiv = elem.closest('.grafana-target-inner');

            if (elem.hasClass('show-function-controls')) {
              elem.removeClass('show-function-controls');
              targetDiv.removeClass('has-open-function');
              $funcControls.hide();
              return;
            }

            elem.addClass('show-function-controls');
            targetDiv.addClass('has-open-function');

            setTimeout(function() {
              var pos = getPosition();
              $funcControls.css('position', 'absolute');
              $funcControls.css('top', (pos.top - 78) + 'px');
              $funcControls.css('left', pos.left + 'px');
              $funcControls.css('width', pos.width + 'px');
              console.log(pos);
              $funcControls.show();
            }, 10);
          }

          function addElementsAndCompile() {
            $funcLink.appendTo(elem);

            _.each(funcDef.params, function(param, index) {
              var $paramLink = $('<a ng-click="" class="graphite-func-param-link">' + func.params[index] + '</a>');
              var $input = $(paramTemplate);

              $paramLink.appendTo(elem);
              $input.appendTo(elem);

              $input.blur(_.partial(inputBlur, index));
              $input.keyup(inputKeyDown);
              $input.keypress(_.partial(inputKeyPress, index));
              $paramLink.click(_.partial(clickFuncParam, index));

              if (index !== funcDef.params.length - 1) {
                $('<span>, </span>').appendTo(elem);
              }

              if (funcDef.params[index].options) {
                addTypeahead($input, index);
              }

            });

            $('<span>)</span>').appendTo(elem);

            elem.append($funcControls);

            $compile(elem.contents())($scope);
          }

          function ifJustAddedFocusFistParam() {
            if ($scope.func.added) {
              $scope.func.added = false;
              setTimeout(function() {
                elem.find('.graphite-func-param-link').first().click();
              }, 10);
            }
          }

          function registerFuncControlsToggle() {
            $funcLink.click(toggleFuncControls);
          }

          function registerFuncControlsActions() {
            $funcControls.click(function(e) {
              var $target = $(e.target);
              if ($target.hasClass('icon-remove')) {
                toggleFuncControls();
                $scope.$apply(function() {
                  $scope.removeFunction($scope.func);
                });
              }
            });
          }

          addElementsAndCompile();
          ifJustAddedFocusFistParam();
          registerFuncControlsToggle();
          registerFuncControlsActions();
        }
      };

    });


});