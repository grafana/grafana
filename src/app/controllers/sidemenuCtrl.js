define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SideMenuCtrl', function($scope, $location) {

    $scope.menu = [
      {
        text: "Dashbord",
        href: "/",
        icon: "fa fa-th-large",
        links: [
          { text: 'Settings', href:"asd", icon: "fa fa-cogs" },
          { text: 'Templating', href:"asd", icon: "fa fa-cogs" },
          { text: 'Annotations', href:"asd", icon: "fa fa-bolt" },
          { text: 'More', href:"asd", icon: "fa fa-bolt" },
        ]
      },
      {
        text: "Account", href: "/account",
        icon: "fa fa-shield",
        links: [
          { text: 'Data sources', href:"/account/datasources", icon: "fa fa-sitemap" },
          { text: 'Users', href:"/account/datasources", icon: "fa fa-users" },
          { text: 'API Keys', href:"/account/datasources", icon: "fa fa-key" },
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

    $scope.onAppEvent('$routeChangeSuccess', function() {
      $scope.updateState();
    });

    $scope.updateState = function() {
      var currentPath = $location.path();
      _.each($scope.menu, function(item) {
        item.active = false;

        if (item.href === currentPath) {
          item.active = true;
        }

        _.each(item.links, function(link) {
          link.active = false;

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
