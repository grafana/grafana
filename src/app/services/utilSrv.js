define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('utilSrv', function($rootScope, $modal, $q) {

    this.init = function() {
      $rootScope.onAppEvent('show-modal', this.showModal);
    };

    this.showModal = function(e, options) {
      var modal = $modal({
        template: options.src,
        persist: false,
        show: false,
        scope: options.scope,
        keyboard: false
      });

      $q.when(modal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

  });

});
