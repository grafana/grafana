define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SideMenuCtrl', function($scope, $location) {

    $scope.menu = [
      {
        text: "Dashbord",
        href: "/",
        startsWith: '/dashboard/',
        icon: "fa fa-th-large",
        links: [
          { text: 'Settings',    editview: 'settings',    icon: "fa fa-cogs" },
          { text: 'Templating',  editview: 'templating',  icon: "fa fa-cogs" },
          { text: 'Annotations', editview: 'annotations', icon: "fa fa-bolt" },
          { text: 'More', href:"asd", icon: "fa fa-bolt" },
        ]
      },
      {
        text: "Account", href: "/account",
        icon: "fa fa-shield",
        links: [
          { text: 'Data sources', href:"/account/datasources", icon: "fa fa-sitemap" },
          { text: 'Users', href:"/account/users", icon: "fa fa-users" },
          { text: 'API Keys', href:"/account/apikeys", icon: "fa fa-key" },
        ]
      },
      {
        text: "Profile", href: "/profile",
        icon: "fa fa-user",
        links: [
          { text: 'Password', href:"asd", icon: "fa fa-lock" },
        ]
      }
    ];

    $scope.onAppEvent('$routeUpdate', function() {
      $scope.updateState();
    });

    $scope.onAppEvent('$routeChangeSuccess', function() {
      $scope.updateState();
    });

    $scope.updateState = function() {
      var currentPath = $location.path();
      var search = $location.search();

      _.each($scope.menu, function(item) {
        item.active = false;

        if (item.href === currentPath) {
          item.active = true;
        }

        if (item.startsWith) {
          if (currentPath.indexOf(item.startsWith) === 0) {
            item.active = true;
          }
        }

        _.each(item.links, function(link) {
          link.active = false;

          if (link.editview) {
            var params = {};
            _.each(search, function(value, key) {
              if (value !== null) { params[key] = value; }
            });

            params.editview = link.editview;
            link.href = currentPath + '?' + $.param(params);
          }

          if (link.href === currentPath) {
            item.active = true;
            link.active = true;
          }
        });
      });
    };

    $scope.init = function() {
      $scope.updateState();
    };
  });

});
