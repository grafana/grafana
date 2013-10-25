define(['angular', 'jquery', 'underscore', 'moment'], function (angular, $, _, moment) {
  'use strict';

  var module = angular.module('kibana.filters');

  module.filter('stringSort', function() {
    return function(input) {
      return input.sort();
    };
  });

  module.filter('pinnedQuery', function(querySrv) {
    return function( items, pinned) {
      var ret = _.filter(querySrv.ids,function(id){
        var v = querySrv.list[id];
        if(!_.isUndefined(v.pin) && v.pin === true && pinned === true) {
          return true;
        }
        if((_.isUndefined(v.pin) || v.pin === false) && pinned === false) {
          return true;
        }
      });
      return ret;
    };
  });

  /*
    Filter an array of objects by elasticsearch version requirements
  */
  module.filter('esVersion', function(esVersion) {
    return function(items, require) {
      var ret = _.filter(items,function(qt) {
        return esVersion.is(qt[require]) ? true : false;
      });
      return ret;
    };
  });

  module.filter('slice', function() {
    return function(arr, start, end) {
      if(!_.isUndefined(arr)) {
        return arr.slice(start, end);
      }
    };
  });

  module.filter('stringify', function() {
    return function(arr) {
      if(_.isObject(arr) && !_.isArray(arr)) {
        return angular.toJson(arr);
      } else {
        return _.isNull(arr) ? null : arr.toString();
      }
    };
  });

  module.filter('moment', function() {
    return function(date,mode) {
      switch(mode) {
      case 'ago':
        return moment(date).fromNow();
      }
      return moment(date).fromNow();
    };
  });

  module.filter('noXml', function() {
    var noXml = function(text) {
      return _.isString(text)
        ? text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;')
        : text;
    };
    return function(text) {
      return _.isArray(text)
        ? _.map(text, noXml)
        : noXml(text);
    };
  });

  module.filter('urlLink', function() {
    var  //URLs starting with http://, https://, or ftp://
      r1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim,
      //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
      r2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim,
      //Change email addresses to mailto:: links.
      r3 = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim;

    var urlLink = function(text) {
      var t1,t2,t3;
      if(!_.isString(text)) {
        return text;
      } else {
        _.each(text.match(r1), function() {
          t1 = text.replace(r1, "<a href=\"$1\" target=\"_blank\">$1</a>");
        });
        text = t1 || text;
        _.each(text.match(r2), function() {
          t2 = text.replace(r2, "$1<a href=\"http://$2\" target=\"_blank\">$2</a>");
        });
        text = t2 || text;
        _.each(text.match(r3), function() {
          t3 = text.replace(r3, "<a href=\"mailto:$1\">$1</a>");
        });
        text = t3 || text;
        return text;
      }
    };
    return function(text) {
      return _.isArray(text)
        ? _.map(text, urlLink)
        : urlLink(text);
    };
  });

  module.filter('gistid', function() {
    var gist_pattern = /(\d{5,})|([a-z0-9]{10,})|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
    return function(input) {
      if(!(_.isUndefined(input))) {
        var output = input.match(gist_pattern);
        if(!_.isNull(output) && !_.isUndefined(output)) {
          return output[0].replace(/.*\//, '');
        }
      }
    };
  });

});