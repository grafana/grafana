define([
  'underscore'
],
function (_) {
  'use strict';

  var funcDefList = [];
  var index = [];

  function addFuncDef(funcDef) {
    funcDefList.push(funcDef);
    index[funcDef.name] = funcDef;
    index[funcDef.shortName || funcDef.name] = funcDef;
  }

  addFuncDef({
    name: 'scaleToSeconds',
    params: [ { name: 'seconds', type: 'int' } ],
    defaultParams: [1],
  });

  addFuncDef({
    name: "alias",
    params: [
      { name: "alias", type: 'string' }
    ],
    defaultParams: ['alias']
  });

  addFuncDef({
    name: 'sumSeries',
    shortName: 'sum',
    params: [],
    defaultParams: []
  });

  addFuncDef({
    name: "groupByNode",
    params: [
      {
        name: "node",
        type: "node",
      },
      {
        name: "function",
        type: "function",
      }
    ],
    defaultParams: [3, "sum"]
  });

  addFuncDef({
    name: 'aliasByNode',
    params: [ { name: "node", type: "node", } ],
    defaultParams: [3]
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
    createFuncInstance: function(name) {
      if (_.isString(name)) {
        var funcDef = index[name];
        if (!funcDef) {
          throw { message: 'Method not found ' + name };
        }
        name = funcDef;
      }
      return new FuncInstance(name);
    },

    getDefList: function() {
      return funcDefList.slice(0);
    }
  };

});