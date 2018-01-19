# -*- mode: ruby -*-
# vi: set ft=ruby :

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

$build_and_test = <<SCRIPT
echo "Provisioning system to compile and test Apache Thrift."

# Create swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo swapon -s

# Update the system
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -qq -y

# Install Dependencies
# ---
# General dependencies
sudo apt-get install -qq automake libtool flex bison pkg-config g++ libssl-dev make libqt4-dev git debhelper

# C++ dependencies
sudo apt-get install -qq libboost-dev libboost-test-dev libboost-program-options-dev libboost-filesystem-dev libboost-system-dev libevent-dev 

# Java dependencies
sudo apt-get install -qq ant openjdk-7-jdk maven

# Python dependencies
sudo apt-get install -qq python-all python-all-dev python-all-dbg python-setuptools python-support python-six python3-six

# Ruby dependencies
sudo apt-get install -qq ruby ruby-dev
sudo gem install bundler rake

# Perl dependencies
sudo apt-get install -qq libbit-vector-perl libclass-accessor-class-perl

# Php dependencies
sudo apt-get install -qq php5 php5-dev php5-cli php-pear re2c

# GlibC dependencies
sudo apt-get install -qq libglib2.0-dev

# Erlang dependencies
sudo apt-get install -qq erlang-base erlang-eunit erlang-dev erlang-tools

# GO dependencies
echo "golang-go golang-go/dashboard boolean false" | debconf-set-selections
sudo apt-get -y install -qq golang golang-go

# Haskell dependencies
sudo apt-get install -qq ghc cabal-install libghc-binary-dev libghc-network-dev libghc-http-dev libghc-hashable-dev libghc-unordered-containers-dev libghc-vector-dev
sudo cabal update

# Lua dependencies
sudo apt-get install -qq lua5.2 lua5.2-dev

# Node.js dependencies
sudo apt-get install -qq nodejs nodejs-dev nodejs-legacy npm

# CSharp
sudo apt-get install -qq mono-gmcs mono-devel mono-xbuild mono-complete libmono-system-web2.0-cil
sudo apt-get install -qq mingw32 mingw32-binutils mingw32-runtime nsis

# D dependencies
sudo wget http://master.dl.sourceforge.net/project/d-apt/files/d-apt.list -O /etc/apt/sources.list.d/d-apt.list
sudo apt-get update && sudo apt-get -y --allow-unauthenticated install --reinstall d-apt-keyring && sudo apt-get update
sudo apt-get install -qq xdg-utils dmd-bin

# Customize the system
# ---
# Default java to latest 1.7 version
update-java-alternatives -s java-1.7.0-openjdk-amd64 

# PHPUnit package broken in ubuntu. see https://bugs.launchpad.net/ubuntu/+source/phpunit/+bug/701544
sudo apt-get upgrade pear
sudo pear channel-discover pear.phpunit.de
sudo pear channel-discover pear.symfony.com
sudo pear channel-discover components.ez.no
sudo pear update-channels
sudo pear upgrade-all
sudo pear install --alldeps phpunit/PHPUnit

date > /etc/vagrant.provisioned

# Start the source build
# ---
echo "Starting Apache Thrift build..."
cd /thrift
sh bootstrap.sh
sh configure
make
make check
echo "Finished building Apache Thrift."

SCRIPT

Vagrant.configure("2") do |config|
  # Ubuntu 14.04 LTS (Trusty Tahr)
  config.vm.box = "trusty64"
  config.vm.box_url = "https://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-amd64-vagrant-disk1.box"

  config.vm.synced_folder "../", "/thrift"

  config.vm.provider :virtualbox do |vbox|
    vbox.customize ["modifyvm", :id, "--memory", "1024"]
    vbox.customize ["modifyvm", :id, "--cpus", "2"]
    vbox.customize ["modifyvm", :id, "--rtcuseutc", "on"]
  end

  # Run the build script to configure the system
  config.vm.provision :shell, :inline => $build_and_test
end
