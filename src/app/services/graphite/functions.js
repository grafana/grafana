define([
],
function () {
  'use strict';

  return [
    {
      name: "scaleToSeconds",
      params: [ { name: "seconds", type: "int" } ],
      defaultParams: [1]
    },
    {
      name: "sumSeries",
      params: [],
    },
    {
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
      defaultParams: [3, "sumSeries"]
    },
    {
      name: "alias",
      params: [
        { name: "alias", type: 'string' }
      ],
      defaultParams: ['alias']
    },
    {
      name: 'aliasByNode',
      params: [ { name: "node", type: "node", } ],
      defaultParams: [3]
    }
  ];

});