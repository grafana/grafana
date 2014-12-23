define([
  './helpers',
  'services/atlas/atlasDatasource'
], function(helpers) {
  'use strict';

  describe('AtlasDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv']));
    beforeEach(ctx.createService('AtlasDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ url: [''] });
    });

    describe('When querying atlas with multiple stack query targets', function() {
      var results;
      var urlExpected = "/api/v1/graph?e=now&format=json&q=name,sps,:eq,:sum,name,ssCpuUser,:eq,:sum&s=now-1h&step=10m";
      var query = {
        range: { from: 'now-1h', to: 'now' },
        targets: [
          { query: 'name,sps,:eq,:sum' },
          { query: 'name,ssCpuUser,:eq,:sum' }
        ],
        interval: '10m'
      };

      var response = {
        start: 1419312000000,
        step: 600000,
        legend: [
          "atlas.legacy=epic, name=sps, nf.app=nccp",
          "atlas.legacy=epic, name=ssCpuUser, nf.app=alerttest, nf.asg=alerttest-v042, nf.cluster=alerttest, nf.node=alert1"
        ],
        metrics: [{}],
        values:[
          [604930.164776, 18.537333],
          [593086.155587, 20.939233],
          [605539.831071, 20.855982]
        ],
        notices: []
      };

      beforeEach(function() {
        ctx.$httpBackend.expect('GET', urlExpected).respond(response);
        ctx.ds.query(query).then(function(data) { results = data; });
        ctx.$httpBackend.flush();
      });

      it('should generate the correct query', function() {
        ctx.$httpBackend.verifyNoOutstandingExpectation();
      });

      it('should return series list', function() {
        expect(results.data.length).to.be(2);
        expect(results.data[0].target).to.be('atlas.legacy=epic, name=sps, nf.app=nccp');
        expect(results.data[0].datapoints[0]).to.eql([604930.164776, 1419312000000]);
        expect(results.data[0].datapoints[1]).to.eql([593086.155587, 1419312000000 + 600000]);
      });
    });
  });
});

