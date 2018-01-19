## Debian/Ubuntu install
The following command will install tools and libraries required to build and install the Apache Thrift compiler and C++ libraries on a Debian/Ubuntu Linux based system.

	sudo apt-get install automake bison flex g++ git libboost1.55-all-dev libevent-dev libssl-dev libtool make pkg-config

Debian 7/Ubuntu 12 users need to manually install a more recent version of automake and (for C++ library and test support) boost:

    wget http://ftp.debian.org/debian/pool/main/a/automake-1.15/automake_1.15-3_all.deb
    sudo dpkg -i automake_1.15-3_all.deb

    wget http://sourceforge.net/projects/boost/files/boost/1.60.0/boost_1_60_0.tar.gz                                                                      tar xvf boost_1_60_0.tar.gz
    cd boost_1_60_0
    ./bootstrap.sh
    sudo ./b2 install

## Optional packages

If you would like to build Apache Thrift libraries for other programming languages you may need to install additional packages. The following languages require the specified additional packages:

 * Java
	* To build Apache Thrift support for Java you will need to install the ant package and Java JDK v1.7 or higher. Type **javac** to see a list of available packages, pick the one you prefer and **apt-get install** it (e.g. openjdk-7-jdk).
 * Ruby
	* ruby-full ruby-dev ruby-rspec rake rubygems libdaemons-ruby libgemplugin-ruby mongrel
 * Python
	* python-all python-all-dev python-all-dbg
 * Perl
	* libbit-vector-perl libclass-accessor-class-perl
 * Php, install
	* php5-dev php5-cli phpunit
 * C_glib
	* libglib2.0-dev
 * Erlang
	* erlang-base erlang-eunit erlang-dev
 * Csharp
	* mono-gmcs mono-devel libmono-system-web2.0-cil nunit nunit-console
 * Haskell
	* ghc6 cabal-install libghc6-binary-dev libghc6-network-dev libghc6-http-dev
 * Thrift Compiler for Windows
	* mingw32 mingw32-binutils mingw32-runtime nsis


## Additional reading

For more information on the requirements see: [Apache Thrift Requirements](/docs/install)

For more information on building and installing Thrift see: [Building from source](/docs/BuildingFromSource)
