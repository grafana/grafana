## OS X Setup
The following command install all the required tools and libraries to build and install the Apache Thrift compiler on a OS X based system. 

### Install Boost
Download the boost library from [boost.org](http://www.boost.org) untar compile with

	./bootstrap.sh
	sudo ./b2 threading=multi address-model=64 variant=release stage install

### Install libevent
Download [libevent](http://monkey.org/~provos/libevent), untar and compile with

	./configure --prefix=/usr/local 
	make
	sudo make install

### Building Apache Thrift
Download the latest version of [Apache Thrift](/download), untar and compile with

	./configure --prefix=/usr/local/ --with-boost=/usr/local --with-libevent=/usr/local

## Additional reading

For more information on the requirements see: [Apache Thrift Requirements](/docs/install)

For more information on building and installing Thrift see: [Building from source](/docs/BuildingFromSource)

