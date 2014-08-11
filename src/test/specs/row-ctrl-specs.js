define([
  './helpers',
  'controllers/row'
], function(helpers) {
  'use strict';

  describe('RowCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('RowCtrl'));

    describe('when getting rowSpan', function() {
      it('should return sum of panels spans', function() {
        var spanLeft = ctx.scope.rowSpan({ panels: [{ span: 2 }, { span: 3 }] });
        expect(spanLeft).to.be(5);
      });
    });

    describe('when adding panel to row with 12 span panel', function() {
      it('should split span in half and add panel with defaults', function() {
        ctx.scope.row = { panels: [{ span: 12 }] };
        ctx.scope.add_panel_default('graph');

        expect(ctx.scope.row.panels[0].span).to.be(6);
        expect(ctx.scope.row.panels[1].span).to.be(6);
        expect(ctx.scope.row.panels[1].type).to.be('graph');
      });
    });

    describe('when duplicating panel', function() {
      it('should try to add it to same row', function() {
        var panel = { span: 4, attr: '123' };
        ctx.scope.row = { panels: [panel] };
        ctx.scope.duplicatePanel(panel, ctx.scope.row);

        expect(ctx.scope.row.panels[0].span).to.be(4);
        expect(ctx.scope.row.panels[1].span).to.be(4);
        expect(ctx.scope.row.panels[1].attr).to.be('123');
      });
    });

    describe('when duplicating panel', function() {
      it('should add row if there is no space left', function() {
        var panel = { span: 12, attr: '123' };
        ctx.scope.row = { panels: [panel] };
        ctx.scope.dashboard = { rows: [ctx.scope.row] };

        ctx.scope.duplicatePanel(panel, ctx.scope.row);

        expect(ctx.scope.row.panels[0].span).to.be(12);
        expect(ctx.scope.row.panels.length).to.be(1);
        expect(ctx.scope.dashboard.rows[1].panels[0].attr).to.be('123');
      });
    });

  });

});

