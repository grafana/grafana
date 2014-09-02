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
        condition_filter: true,
        condition_expression: "code=1",
        groupby_field_add: true,
        groupby_field: 'code'
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('select code, mean(value) from "google.test" where [[$timeFilter]] and code=1 ' +
          'group by time([[$interval]]), code order asc');
      });

      it('should expose groupByFiled', function() {
        expect(builder.groupByField).to.be('code');
      });

    });

    describe('old style raw query', function() {
      var builder = new InfluxQueryBuilder({
        query: 'select host, mean(value) from asd.asd where time > now() - 1h group by time(1s), code order asc',
        rawQuery: true
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('select host, mean(value) from asd.asd where [[$timeFilter]] and time > now() - 1h ' +
          'group by time(1s), code order asc');
      });

      it('should expose groupByFiled', function() {
        expect(builder.groupByField).to.be('host');
      });

    });


  });

});
