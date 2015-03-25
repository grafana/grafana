define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash'
],
  function (angular, $, kbn, moment, _) {
    'use strict';

    var module = angular.module('grafana.directives');
    var data;
    var tableHeight;

    module.directive('grafanaTable', function($rootScope, timeSrv, $compile) {
      return {
        restrict: 'A',
        link: function(scope, elem) {

          scope.height = 280; // set default height for edit mode (prob should be done elsewhere)

          scope.$on('render',function(event, renderData) {
            data = renderData || data;
            if (!data) {
              scope.get_data();
              return;
            }

            render_panel();
          });


          /**
           * Rendering will be done without angular bindings in order to avoid performance penalty in the case
           * that the user wants to view a large number of cells simultaneously.
           */
          function render_panel() {
            var isHeightSet = setTableHeightVariable();
            if (shouldAbortRender(isHeightSet)) {
              return;
            }


            var headers = _.map(data.selectedColumns, function(columnName) {
              return '<th>' + columnName +  '</th>';
            }).join('');

            headers = '<tr>' + headers + '</tr>';

            var tableData = _.reduce(data.datapoints, function(prev, cur) {
              var row = _.map(cur, function(seriesValue) {
                return '<td>' + seriesValue  + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prev += row;
            }, '');



            var html =
              '<div class="table-visualization">' +
                '<div class="table-vis-overflow-container">' +
                  '<table>' +

                    '<thead>' +
                      headers +
                    '</thead>' +

                    '<tbody>' +
                      tableData +
                    '</tbody>' +

                  '</table>' +
                '</div>' +
              '</div>';



            elem.html(html);
            $compile(elem.contents())(scope);

            var thead$el = elem.find('thead');

            // we need to hardcode header widths so they do not get lost when the headers become fixed
            var ths = thead$el.find('th');
            for (var i = 0; i < ths.length; ++i) {
              var el = ths.eq(i);
              var width = el.width();
              var borderWidth = parseInt(el.css('border-width')) || 0;
              el.css('width', width + borderWidth);
            }

            var headerHeight = parseInt(thead$el.css('height')) || 0;

            thead$el
              .css('position', 'absolute') // fix table head in position
              .css('top', -headerHeight + 'px'); // create distance from headers and body


            // margin needed to push the headers above the table body. this has the effect of
            // essentially increasing the directive's height by the header height amount
            elem.find('.table-visualization').css('margin-top', headerHeight + 'px');

            var heightRemainingFromTotal = tableHeight - headerHeight;
            elem.find('.table-vis-overflow-container').css('height', heightRemainingFromTotal + 'px');
            elem.css('height', heightRemainingFromTotal + 'px'); // set physical height of directive
          }


          function shouldAbortRender(isHeightSet) {
            if (!data) {
              return true;
            }

            if ($rootScope.fullscreen && !scope.fullscreen) {
              return true;
            }

            if (!isHeightSet) { return true; }

            if (elem.width() === 0) {
              return false;
            }
          }


          function setTableHeightVariable() {
            try {
              tableHeight = scope.height || scope.panel.height || scope.row.height;
              if (_.isString(tableHeight)) {
                tableHeight = parseInt(tableHeight.replace('px', ''), 10);
              }

              tableHeight -= 5; // padding
              tableHeight -= scope.panel.title ? 24 : 9; // subtract panel title bar

              return true;
            } catch(e) { // IE throws errors sometimes
              return false;
            }
          }


        }
      };
    });




  });
