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
    });

  });

  describe('when getting next panel id', function() {
    var model;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(dashboardSrv) {
      model = dashboardSrv.create({
        rows: [{ panels: [{ id: 5 }]}]
      });
    }));

    it('should return max id + 1', function() {
      expect(model.getNextPanelId()).to.be(6);
    });
  });

  describe('row and panel manipulation', function() {
    var dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(dashboardSrv) {
      dashboard = dashboardSrv.create({});
    }));

    it('row span should sum spans', function() {
      var spanLeft = dashboard.rowSpan({ panels: [{ span: 2 }, { span: 3 }] });
      expect(spanLeft).to.be(5);
    });

    it('adding default should split span in half', function() {
      dashboard.rows = [{ panels: [{ span: 12, id: 7 }] }];
      dashboard.add_panel({span: 4}, dashboard.rows[0]);

      expect(dashboard.rows[0].panels[0].span).to.be(6);
      expect(dashboard.rows[0].panels[1].span).to.be(6);
      expect(dashboard.rows[0].panels[1].id).to.be(8);
    });

    it('duplicate panel should try to add it to same row', function() {
      var panel = { span: 4, attr: '123', id: 10 };
      dashboard.rows = [{ panels: [panel] }];
      dashboard.duplicatePanel(panel, dashboard.rows[0]);

      expect(dashboard.rows[0].panels[0].span).to.be(4);
      expect(dashboard.rows[0].panels[1].span).to.be(4);
      expect(dashboard.rows[0].panels[1].attr).to.be('123');
      expect(dashboard.rows[0].panels[1].id).to.be(11);
    });

    it('duplicate should add row if there is no space left', function() {
      var panel = { span: 12, attr: '123' };
      dashboard.rows = [{ panels: [panel] }];
      dashboard.duplicatePanel(panel, dashboard.rows[0]);

      expect(dashboard.rows[0].panels[0].span).to.be(12);
      expect(dashboard.rows[0].panels.length).to.be(1);
      expect(dashboard.rows[1].panels[0].attr).to.be('123');
    });

  });

  describe('when creating dashboard with editable false', function() {
    var model;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(dashboardSrv) {
      model = dashboardSrv.create({
        editable: false
      });
    }));

    it('should set editable false', function() {
      expect(model.editable).to.be(false);
    });

  });

  describe('when creating dashboard with old schema', function() {
    var model;
    var graph;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(dashboardSrv) {
      model = dashboardSrv.create({
        services: { filter: { time: { from: 'now-1d', to: 'now'}, list: [1] }},
        pulldowns: [
          {
            type: 'filtering',
            enable: true
          },
          {
            type: 'annotations',
            enable: true,
            annotations: [{name: 'old'}]
          }
        ],
        rows: [
          {
            panels: [
              {
                type: 'graphite',
                legend: true,
                aliasYAxis: { test: 2 },
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

    it('should have panel id', function() {
      expect(graph.id).to.be(1);
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

    it('move aliasYAxis to series override', function() {
      expect(graph.seriesOverrides[0].alias).to.be("test");
      expect(graph.seriesOverrides[0].yaxis).to.be(2);
    });

    it('should move pulldowns to new schema', function() {
      expect(model.templating.enable).to.be(true);
      expect(model.annotations.enable).to.be(true);
      expect(model.annotations.list[0].name).to.be('old');
    });

    it('dashboard schema version should be set to latest', function() {
      expect(model.version).to.be(6);
    });

  });

});
