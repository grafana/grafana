define([
  'services/utilSrv'
], function() {
  'use strict';

  describe('utilSrv', function() {
    var serviceToTest;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(utilSrv) {
      serviceToTest = utilSrv;
    }));


    describe('sorting', function() {
      var SortType;
      var columnsToSort;
      var columnSortTypes;

      beforeEach(function() {
        SortType = serviceToTest.sortType;
        columnsToSort = [];
        columnSortTypes = [];
      });

      describe('single column', function() {
        it('should work with asc sorting', function() {
          var data = [
            [4],
            [2],
            [1],
            [3]
          ];

          columnsToSort.push(0); // sort index of only column present
          columnSortTypes.push(SortType.asc);
          serviceToTest.multiColumnSort(data, columnsToSort, columnSortTypes);
          expect(data).to.eql([[1],[2],[3],[4]]);
        });

        it('should work with desc sorting', function() {
          var data = [
            [4],
            [2],
            [1],
            [3]
          ];

          columnsToSort.push(0); // sort index of only column present
          columnSortTypes.push(SortType.desc);
          serviceToTest.multiColumnSort(data, columnsToSort, columnSortTypes);
          expect(data).to.eql([[4],[3],[2],[1]]);
        });

        it('should have no effect with no sorting', function() {
          var data = [
            [4],
            [2],
            [1],
            [3]
          ];

          columnsToSort.push(0); // sort index of only column present
          columnSortTypes.push(SortType.none);
          serviceToTest.multiColumnSort(data, columnsToSort, columnSortTypes);
          expect(data).to.eql([[4],[2],[1],[3]]);
        });


        describe('when multi column sorting', function() {
          it('should respect asc sort on first column and secondary dsc sort on other column', function() {
            var data = [
              [4,5,8],
              [2,5,1],
              [1,4,6],
              [1,9,16],
              [3,3,5],
              [1,9,3]
            ];

            columnsToSort = [0, 2];
            columnSortTypes = [SortType.desc, SortType.asc];
            serviceToTest.multiColumnSort(data, columnsToSort, columnSortTypes);

            var expectedResult =
              [
                [4,5,8],
                [3,3,5],
                [2,5,1],
                [1,9,3],
                [1,4,6],
                [1,9,16]
              ];
            expect(data).to.eql(expectedResult);
          });
        });

      });
    });
  });
});