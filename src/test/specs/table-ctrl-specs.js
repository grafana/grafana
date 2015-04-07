define([
  'helpers',
  'panels/table/module'
], function(helpers) {
  'use strict';

  describe('TablePanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.table'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('TablePanelCtrl'));


    it('should transform the data returned by the datasource correctly', function() {
      var timestampColumnName = ctx.scope.timestampColumnName;

      var datasourceInput = {
        data: [
          {
            target: 'Col1',
            datapoints: [
              [200, 1428422180000],
              [300, 1428422180100],
              [500, 1428422180300],
              [500, 1428422180400]
            ]
          },

          {
            target: 'Col2',
            datapoints: [
              [80, 1428422180000],
              [0, 1428422180100],
              [40, 1428422180200],
              [0, 1428422180300]
            ]
          }
        ]
      };


      ctx.scope.dataHandler(datasourceInput);
      ctx.scope.$digest();

      var expectedResult = {
        columnOrder: [timestampColumnName, "Col1", "Col2"],
        values: [
          { timestampColumnName: 1428422180000, Col1: 200, Col2: 80 },
          { timestampColumnName: 1428422180100, Col1: 300, Col2: 0 },
          { timestampColumnName: 1428422180200, Col1: undefined, Col2: 40 }, // col1 had no data at the timestamp, so should be undefined
          { timestampColumnName: 1428422180300, Col1: 500, Col2: 0 },
          { timestampColumnName: 1428422180400, Col1: 500, Col2: undefined } // ditto
        ]
      };


      expect(ctx.scope.tableData.columnOrder).to.eql(expectedResult.columnOrder);


      // deep comaprison of array of objects
      expect(ctx.scope.tableData.values.length).to.eql(expectedResult.values.length);

      // loop in order through each object needed since .eql was not working correctly for array of objects
      for (var i = 0; i < ctx.scope.tableData.values; ++i) {
        expect(ctx.scope.tableData.values[i]).to.eql(expectedResult.values[i]);
      }
    });

  });
});

