define([
  'angular',
  'jquery',
  'lodash'
],
  function (angular, $, _) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('grafanaTable', function($rootScope, $timeout) {
      var data;
      var tableHeight;
      var headerHeight;

      // paging variables
      var dataToSkip;
      var pagedData;
      var numPages = 1;
      var minPage = 1;


      var sortingType = {
        none: 0,
        asc: 1,
        desc: 2
      };

      return {
        restrict: 'A',
        templateUrl: 'app/panels/table/table.html',
        link: function(scope, elem) {
          scope.height = 280; // set default height for edit mode (prob should be done elsewhere)
          scope.tablePageSize = 20;

          scope.$on('render',function(event, renderData) {
            data = renderData || data;
            if (!data) {
              scope.get_data();
              return;
            }

            numPages = Math.ceil(data.datapoints.length / scope.tablePageSize);
            minPage = numPages > 0 ? 1 : 0;

            scope.curTablePage = minPage; // set to first page, since new data has come in
            render_panel();
          });


          scope.$watch('curTablePage', function() {
            scope.curTablePage = parseInt(scope.curTablePage) || 1; // ensure page is numeric

            if (scope.curTablePage < minPage) {
              scope.curTablePage = minPage;
            }

            if (scope.curTablePage > numPages) {
              scope.curTablePage = numPages;
            }


            if (!data) {
              return;
            }

            render_panel();
          });


          function render_panel() {
            var isHeightSet = setTableHeightVariable();
            if (shouldAbortRender(isHeightSet)) {
              return;
            }

            // handle paging
            dataToSkip = scope.tablePageSize * (scope.curTablePage - 1);
            pagedData = data.datapoints.slice(dataToSkip, scope.tablePageSize + dataToSkip);


            scope.columnNames = data.selectedColumns;

            // avoid using angular bindings for table data in order to avoid performance penalty
            // in case user wants to view a large number of cells simultaneously
            scope.tableData = _.reduce(pagedData, function(prev, cur) {
              var row = _.map(cur, function(seriesValue) {
                return '<td>' + seriesValue  + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prev += row;
            }, '');

            elem.find('.table-vis-overflow-container').height(tableHeight);
            elem.height(tableHeight); // set physical height of directive

            $timeout(function() { // after angular is processing, do jquery stuff
              performHeaderPositioning();
            }, 0);
          }

          // on resize, the absolutely positioned headers will be shifted, during shift we should hide them
          $(window).resize(function() {
            performHeaderPositioning();
          });


          function performHeaderPositioning() {
            var realHeaders = elem.find('.real-table-header');
            var fixedHeaders = elem.find('.fixed-table-header');
            var container = elem.find('.table-vis-overflow-container');

            for (var i = 0; i < realHeaders.length; ++i) {
              var realEl = realHeaders.eq(i);
              var fixedEl = fixedHeaders.eq(i);

              var borderWidth = parseFloat(realEl.css('borderWidth')) || 0;

              fixedEl.width(realEl.width() + borderWidth);
              fixedEl.css({ left: realEl.position().left, top: container.position().top });
            }

            fixedHeaders.show();
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
