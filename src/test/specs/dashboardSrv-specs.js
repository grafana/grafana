define([
  'services/dashboard/dashboardSrv'
], function() {
  'use strict';

  describe('when creating new dashboard with defaults only', function() {
    var model;

    beforeEach(module('grafana.services'));

    beforeEach(inject(function(dashboardSrv) {
      model = dashboardSrv.create({});
    }));

    it('should have title', function() {
      expect(model.title).to.be('No Title');
    });

    it('should have default properties', function() {
      expect(model.rows.length).to.be(0);
      expect(model.nav.length).to.be(1);
      expect(model.pulldowns.length).to.be(2);
    });

  });

  describe('when creating dashboard with old schema', function() {
    var model;
    var graph;

    beforeEach(module('grafana.services'));

    beforeEach(inject(function(dashboardSrv) {
      model = dashboardSrv.create({
        services: { filter: { time: { from: 'now-1d', to: 'now'}, list: [1] }},
        rows: [
          {
            panels: [
              {
                type: 'graphite',
                legend: true,
                grid: { min: 1, max: 10 }
              }
            ]
          }
        ]
      });

      graph = model.rows[0].panels[0];

    }));

    it('should have title', function() {
      expect(model.title).to.be('No Title');
    });

    it('should move time and filtering list', function() {
      expect(model.time.from).to.be('now-1d');
      expect(model.templating.list[0]).to.be(1);
    });

    it('graphite panel should change name too graph', function() {
      expect(graph.type).to.be('graph');
    });

    it('update legend setting', function() {
      expect(graph.legend.show).to.be(true);
    });

    it('update grid options', function() {
      expect(graph.grid.leftMin).to.be(1);
      expect(graph.grid.leftMax).to.be(10);
    });

    it('dashboard schema version should be set to latest', function() {
      expect(model.version).to.be(2);
    });

  });


});
