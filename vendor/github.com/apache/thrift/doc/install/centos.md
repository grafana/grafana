# Building Apache Thrift on CentOS 6.5

Starting with a minimal installation, the following steps are required to build Apache Thrift on Centos 6.5. This example builds from source, using the current development master branch. These instructions should also work with Apache Thrift releases beginning with 0.9.2.

## Update the System

	sudo yum -y update

## Install the Platform Development Tools

	sudo yum -y groupinstall "Development Tools"

## Upgrade autoconf/automake/bison

	sudo yum install -y wget

### Upgrade autoconf

	wget http://ftp.gnu.org/gnu/autoconf/autoconf-2.69.tar.gz
	tar xvf autoconf-2.69.tar.gz
	cd autoconf-2.69
	./configure --prefix=/usr
	make
	sudo make install
	cd ..

### Upgrade automake

	wget http://ftp.gnu.org/gnu/automake/automake-1.14.tar.gz
	tar xvf automake-1.14.tar.gz
	cd automake-1.14
	./configure --prefix=/usr
	make
	sudo make install
	cd ..

### Upgrade bison

	wget http://ftp.gnu.org/gnu/bison/bison-2.5.1.tar.gz
	tar xvf bison-2.5.1.tar.gz
	cd bison-2.5.1
	./configure --prefix=/usr
	make
	sudo make install
	cd ..

## Add Optional C++ Language Library Dependencies

All languages require the Apache Thrift IDL Compiler and at this point everything needed to make the IDL Compiler is installed (if you only need the compiler you can skip to the Build step). 

If you will be developing Apache Thrift clients/servers in C++ you will also need additional packages to support the C++ shared library build.

### Install C++ Lib Dependencies

	sudo yum -y install libevent-devel zlib-devel openssl-devel

### Upgrade Boost >= 1.53

	wget http://sourceforge.net/projects/boost/files/boost/1.53.0/boost_1_53_0.tar.gz
	tar xvf boost_1_53_0.tar.gz
	cd boost_1_53_0
	./bootstrap.sh
	sudo ./b2 install

## Build and Install the Apache Thrift IDL Compiler

	git clone https://git-wip-us.apache.org/repos/asf/thrift.git
	cd thrift
	./bootstrap.sh
	./configure --with-lua=no
	make
	sudo make install

This will build the compiler (thrift/compiler/cpp/thrift --version) and any language libraries supported. The make install step installs the compiler on the path: /usr/local/bin/thrift
You can use the ./configure --enable-libs=no switch to build the Apache Thrift IDL Compiler only without lib builds. To run tests use "make check".
