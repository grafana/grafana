define([], function() {
  'use strict';

  return {
    get: function(key) {
      return window.localStorage[key];
    },
    set: function(key, value) {
      window.localStorage[key] = value;
    },
    getBool: function(key) {
      return window.localStorage[key] === 'true' ? true : false;
    },
    delete: function(key) {
      window.localStorage.removeItem(key);
    }

  };

});
