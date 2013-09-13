define([
  'underscore-src'
],
function () {
  'use strict';

  var _ = window._;

  /*
    Mixins :)
  */
  _.mixin({
    move: function (array, fromIndex, toIndex) {
      array.splice(toIndex, 0, array.splice(fromIndex, 1)[0] );
      return array;
    },
    remove: function (array, index) {
      array.splice(index, 1);
      return array;
    },
    toggleInOut: function(array,value) {
      if(_.contains(array,value)) {
        array = _.without(array,value);
      } else {
        array.push(value);
      }
      return array;
    }
  });

  return _;
});