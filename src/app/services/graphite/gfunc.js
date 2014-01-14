define([
  'underscore'
],
function (_) {
  'use strict';

  var index = [];
  var categories = {
    Combine: [],
    Transform: [],
    Calculate: [],
    Filter: [],
    Special: []
  };

  function addFuncDef(funcDef) {
    funcDef.params = funcDef.params || [];
    funcDef.defaultParams = funcDef.defaultParams || [];

    if (funcDef.category) {
      funcDef.category.push(funcDef);
    }
    index[funcDef.name] = funcDef;
    index[funcDef.shortName || funcDef.name] = funcDef;
  }

  addFuncDef({
    name: 'scaleToSeconds',
    category: categories.Transform,
    params: [ { name: 'seconds', type: 'int' } ],
    defaultParams: [1],
  });

  addFuncDef({
    name: "alias",
    category: categories.Special,
    params: [ { name: "alias", type: 'string' } ],
    defaultParams: ['alias']
  });

  addFuncDef({
    name: "holtWintersForecast",
    category: categories.Calculate,
  });

  addFuncDef({
    name: "holtWintersConfidenceBands",
    category: categories.Calculate,
    params: [ { name: "delta", type: 'int' } ],
    defaultParams: [3]
  });

  addFuncDef({
    name: "holtWintersAberration",
    category: categories.Calculate,
    params: [ { name: "delta", type: 'int' } ],
    defaultParams: [3]
  });

  addFuncDef({
    name: 'sumSeries',
    shortName: 'sum',
    category: categories.Combine,
  });

  addFuncDef({
    name: 'averageSeries',
    shortName: 'avg',
    category: categories.Combine,
  });

  addFuncDef({
    name: "groupByNode",
    category: categories.Special,
    params: [
      {
        name: "node",
        type: "select",
        options: [1,2,3,4,5,6,7,8,9,10,12]
      },
      {
        name: "function",
        type: "select",
        options: ['sum', 'avg']
      }
    ],
    defaultParams: [3, "sum"]
  });

  addFuncDef({
    name: 'aliasByNode',
    category: categories.Special,
    params: [ { name: "node", type: "select", options: [1,2,3,4,5,6,7,8,9,10,12] } ],
    defaultParams: [3]
  });

  addFuncDef({
    name: 'scale',
    category: categories.Transform,
    params: [ { name: "factor", type: "int", } ],
    defaultParams: [1]
  });

  addFuncDef({
    name: 'integral',
    category: categories.Transform,
  });

  addFuncDef({
    name: 'derivate',
    category: categories.Transform,
  });

  addFuncDef({
    name: 'timeShift',
    category: categories.Transform,
    params: [ { name: "amount", type: "select", options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'] }],
    defaultParams: ['1d']
  });

  addFuncDef({
    name: 'summarize',
    category: categories.Transform,
    params: [ { name: "interval", type: "string" }],
    defaultParams: ['1h']
  });

  _.each(categories, function(funcList, catName) {
    categories[catName] = _.sortBy(funcList, 'name');
  });

  function FuncInstance(funcDef) {
    this.def = funcDef;
    this.params = funcDef.defaultParams.slice(0);
    this.updateText();
  }

  FuncInstance.prototype.updateText = function () {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    var text = this.def.name + '(';
    _.each(this.def.params, function(param, index) {
      text += this.params[index] + ', ';
    }, this);
    text = text.substring(0, text.length - 2);
    text += ')';
    this.text = text;
  };

  return {
    createFuncInstance: function(funcDef) {
      if (_.isString(funcDef)) {
        if (!index[funcDef]) {
          throw { message: 'Method not found ' + name };
        }
        funcDef = index[funcDef];
      }
      return new FuncInstance(funcDef);
    },

    getCategories: function() {
      return categories;
    }
  };

});