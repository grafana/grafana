define([
  'angular',
  'kbn',
],
function (angular, kbn) {
  'use strict';

  angular
    .module('grafana.services')
    .service('linkSrv', function(templateSrv, timeSrv) {

      this.getPanelLinkAnchorInfo = function(link) {
        var info = {};
        if (link.type === 'absolute') {
          info.target = '_blank';
          info.href = templateSrv.replace(link.url || '');
          info.title = templateSrv.replace(link.title || '');
          info.href += '?';

        }
        else {
          info.title = templateSrv.replace(link.title || '');
          var slug = kbn.slugifyForUrl(link.dashboard || '');
          info.href = '#dashboard/db/' + slug + '?';
        }

        var range = timeSrv.timeRangeForUrl();
        info.href += 'from=' + range.from;
        info.href += '&to=' + range.to;

        if (link.params) {
          info.href += "&" + templateSrv.replace(link.params);
        }

        return info;
      };

    });
});
