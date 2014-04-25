define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('unsavedChangesSrv', function($rootScope, $modal, dashboard, $q, $location) {
    var self = this;

    var modalScope = $rootScope.$new();

    $rootScope.$on("$locationChangeStart", function(event, next, current) {
      if (self.has_unsaved_changes()) {
        event.preventDefault();
        self.next = next;
        self.open_modal();
      }
    });

    this.open_modal = function() {
      var confirmModal = $modal({
          template: './app/partials/unsaved-changes.html',
          persist: true,
          show: false,
          scope: modalScope,
          keyboard: false
        });

      $q.when(confirmModal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

    this.has_unsaved_changes = function() {
      if (!dashboard.original) {
        return false;
      }

      var current = angular.copy(dashboard.current);
      var currentJson = angular.toJson(current);
      var originalJson = angular.toJson(dashboard.original);

      if (currentJson !== originalJson) {
        return true; //confirm('There are unsaved changes, are you sure you want to change dashboard?');
      }

      return false;
    };

    modalScope.ignore = function() {
      dashboard.original = null;
      var baseLen = $location.absUrl().length - $location.url().length;
      var nextUrl = self.next.substring(baseLen);
      $location.url(nextUrl);
    };

    modalScope.save = function() {

    };

  });
});