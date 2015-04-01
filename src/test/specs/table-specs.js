define([
  'angular',
  'lodash',
  'panels/table/table'
], function(angular, _) {
  'use strict';

  // Column names are sequential strings
  // If the user requests 1 column, the returned column name will "1"
  // if the user requests 2 columns, the returned column names will be "1", "2"
  function getRandomData(numColumns, numRows) {
    var title = 'randomTitle';
    var data = [];
    var selectedColumns = [];
    var i;

    for (i = 0; i < numColumns; ++i) {
      selectedColumns.push(String(numColumns + 1));
    }

    for (i = 0; i < numRows; ++i) {
      var row = [];

      for (var j = 0; j < numColumns; ++j) {
        var value = Math.random();
        row.push(value);
      }

      data.push(row);
    }


    return {target: title, datapoints: data, selectedColumns: selectedColumns};
  }

  describe('grafanaTable', function() {
    var elem;
    var scope;

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.directives'));

    beforeEach(inject(function($rootScope, $compile, $templateCache) {
      $templateCache.put('app/panels/table/table.html','<div class="table-visualization"> <div class="table-vis-overflow-container"> <p ng-if="data.datapoints.length === 0">No data available</p> <table> <thead> <tr> <!-- Because html has no concept of a fixed table header, we create a shadow fixed header that will then be stickied directly over the initial position of the real header --> <th class="real-table-header" ng-repeat="header in headers">{{header.columnName}}</th> <th class="fixed-table-header" ng-disabled="!panel.allowSorting" ng-click="headerClicked(header)" style="display: none;" ng-repeat="header in headers"> {{header.columnName}} <i ng-if="header.sortType === sortType.asc" class="fa fa-caret-up"></i> <i ng-if="header.sortType === sortType.desc" class="fa fa-caret-down"></i> </th> </tr> </thead> <tbody ng-bind-html="tableData"></tbody> </table> </div> </div>');

      scope = $rootScope.$new();
      var html = angular.element("<div grafana-table><div>");

      var _d = {
        title   : 'default title',
        datasource: null,
        content : "",
        style: {},
        timeFrom: null,
        timeShift: null,
        targets: [{ rawQuery: true }], // should only allow one query, set to raw query mode on page load
        columnWidth: 'auto',
        allowPaging: true,
        pageLimit: 20,
        allowSorting: true
      };

      scope.permittedColumnWidthRange = _.range(20, 200);
      scope.panel = {};
      _.defaults(scope.panel, _d);

      elem = $compile(html)(scope);
      scope.$digest();
    }));

    beforeEach(function() {
      // following needed for table to render
      scope.fullscreen = true;
      scope.shouldHidePaginationControl = function() { return true; };
    });


    describe('paging', function() {
      it('should return 1 page for 3 data results and a pageLimit of 20', function() {
        var data = getRandomData(1, 3);
        scope.panel.pageLimit = 20;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(1);
      });

      it('should return 3 pages for 15 data results and a pageLimit of 5', function() {
        var data = getRandomData(1, 15);
        scope.panel.pageLimit = 5;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(3);
      });

      it('should return 0 pages for 0 data results', function() {
        var data = getRandomData(1, 0);
        scope.panel.pageLimit = 5;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(0);
      });
    });

    describe('rendered tables', function() {
      // the rendered table body does not use angular bindings, (it uses manual string building) so we should test it
      it ('should have correct number of rows', function() {
        var dataRows = 3;
        scope.panel.pageLimit = 5;

        var data = getRandomData(1, dataRows);

        scope.$emit('render', data);
        scope.$digest();

        var jqLiteTable = angular.element(elem);
        var tbody = jqLiteTable.find('tbody tr');
        expect(tbody.length).to.equal(dataRows);
      });

      it('should limit rendered rows to data page limit', function() {
        var dataRows = 100;
        scope.panel.pageLimit = 5;

        var data = getRandomData(1, dataRows);

        scope.$emit('render', data);
        scope.$digest();

        var jqLiteTable = angular.element(elem);
        var tbody = jqLiteTable.find('tbody tr');
        expect(tbody.length).to.equal(scope.panel.pageLimit);
      });

      it('should have rendered table that matches object data', function() {
        scope.panel.pageLimit = 5;

        var data = getRandomData(2, 5);

        scope.$emit('render', data);
        scope.$digest();

        var jqLiteTable = angular.element(elem);
        var tbody = jqLiteTable.find('tbody tr');

        for (var rowIndex = 0; rowIndex < tbody.length; ++rowIndex) {
          var row = tbody.eq(rowIndex);
          var rowData = row.find('td');

          for (var columnIndex = 0; columnIndex < rowData.length; ++columnIndex) {
            var cell = rowData.eq(columnIndex);
            var cellData = cell.text();
            var objectData = data.datapoints[rowIndex][columnIndex].toString();

            expect(cellData).to.equal(objectData);

          }
        }
      });
    });


    describe('sorting with headers', function() {
      beforeEach(function() {
        var dataRows = 3;
        var numColumns = 3;

        scope.panel.pageLimit = 5;

        var data = getRandomData(numColumns, dataRows);

        scope.$emit('render', data);
        scope.$digest();
      });

      it('should initially have no sorting order', function() {
        scope.headers.forEach(function(header) {
          expect(header.sortType).to.equal(scope.sortType.none);
        });

        expect(scope.panel.columnSortOrder.length).to.equal(0);
      });

      it('should alter header sort state based on user interaction', function() {
        var header = scope.headers[0];
        expect(header.sortType).to.equal(scope.sortType.none);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.asc);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.desc);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.none);
      });


      it('should remove a column from being sorted when user removes sorting', function() {
        // initially sort all headers
        scope.headers.forEach(function(header) {
          scope.headerClicked(header);
        });

        var middleHeader = scope.headers[1];
        scope.headerClicked(middleHeader); // set to desc order
        scope.headerClicked(middleHeader); // set to none
        expect(middleHeader.sortType).to.equal(scope.sortType.none);


        // since middle column is no longer sorted, it should not be in the column sort order
        expect(scope.panel.columnSortOrder.length).to.equal(2);
        expect(scope.panel.columnSortOrder[0]).to.be(scope.headers[0]);
        expect(scope.panel.columnSortOrder[1]).to.be(scope.headers[2]);
      });

      // order of column sorting is retained
      it('the first header clicked should remain first in sorting priority until it is removed', function() {
        var firstHeaderClicked = scope.headers[2];
        var secondHeaderClicked = scope.headers[1];
        var thirdHeaderClicked = scope.headers[0];

        scope.headerClicked(firstHeaderClicked);

        // click other headers
        scope.headerClicked(secondHeaderClicked);
        scope.headerClicked(thirdHeaderClicked);

        // click first header to change sorting order to desc
        scope.headerClicked(firstHeaderClicked);

        // despite being clicked again after other headers were clicked, it should retain it's initial insert order
        expect(scope.panel.columnSortOrder[0]).to.be(firstHeaderClicked);
      });

    });
  });

});
