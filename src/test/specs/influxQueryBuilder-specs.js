define([
  'services/influxdb/influxQueryBuilder'
], function(InfluxQueryBuilder) {
  'use strict';

  describe('InfluxQueryBuilder', function() {

    describe('series with conditon and group by', function() {
      var builder = new InfluxQueryBuilder({
        series: 'google.test',
        column: 'value',
        function: 'mean',
        condition: "code=1",
        groupby_field: 'code'
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('select code, mean(value) from "google.test" where $timeFilter and code=1 ' +
          'group by time($interval), code order asc');
      });

      it('should expose groupByFiled', function() {
        expect(builder.groupByField).to.be('code');
      });

    });

    describe('series with fill and minimum group by time', function() {
      var builder = new InfluxQueryBuilder({
        series: 'google.test',
        column: 'value',
        function: 'mean',
        fill: '0',
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('select mean(value) from "google.test" where $timeFilter ' +
          'group by time($interval) fill(0) order asc');
      });

    });

  });

});
