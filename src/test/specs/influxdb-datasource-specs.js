define([
  './helpers',
  'services/influxdb/influxdbDatasource'
], function(helpers) {
  'use strict';

  describe('InfluxDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createService('InfluxDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ urls: [''], user: 'test', password: 'mupp' });
    });

    describe('When querying influxdb with one target using query editor target spec', function() {
      var results;
      var urlExpected = "/series?p=mupp&q=select+mean(value)+from+%22test%22"+
                        "+where+time+%3E+now()+-+1h+group+by+time(1s)+order+asc&time_precision=s";
      var query = {
        range: { from: 'now-1h', to: 'now' },
        targets: [{ series: 'test', column: 'value', function: 'mean' }],
        interval: '1s'
      };

      var response = [{
        columns: ["time", "sequence_nr", "value"],
        name: 'test',
        points: [[10, 1, 1]],
      }];

      beforeEach(function() {
        ctx.$httpBackend.expect('GET', urlExpected).respond(response);
        ctx.ds.query(query).then(function(data) { results = data; });
        ctx.$httpBackend.flush();
      });

      it('should generate the correct query', function() {
        ctx.$httpBackend.verifyNoOutstandingExpectation();
      });

      it('should return series list', function() {
        expect(results.data.length).to.be(1);
        expect(results.data[0].target).to.be('test.value');
      });

    });

    describe('When querying influxdb with one raw query', function() {
      var results;
      var urlExpected = "/series?p=mupp&q=select+value+from+series"+
                        "+where+time+%3E+now()+-+1h+and+time+%3E+1&time_precision=s";
      var query = {
        range: { from: 'now-1h', to: 'now' },
        targets: [{ query: "select value from series where time > 1", rawQuery: true }]
      };

      var response = [];

      beforeEach(function() {
        ctx.$httpBackend.expect('GET', urlExpected).respond(response);
        ctx.ds.query(query).then(function(data) { results = data; });
        ctx.$httpBackend.flush();
      });

      it('should generate the correct query', function() {
        ctx.$httpBackend.verifyNoOutstandingExpectation();
      });

    });

    describe('When calculating group by time interval', function() {
      it('if blank should use auto interval', function() {
        var result = ctx.ds._getGroupByTimeInterval({}, { interval:'0.1s' });
        expect(result).to.be('0.1s');
      });

      it('if target interval specified should use that interval', function() {
        var result = ctx.ds._getGroupByTimeInterval({interval: '10s'}, { interval:'0.1s' });
        expect(result).to.be('10s');
      });

    });
  });

});

