
## Basic requirements
* A relatively POSIX-compliant *NIX system
    * Cygwin or MinGW can be used on Windows (but there are better options, see below)
* g++ 4.2
* boost 1.53.0
* Runtime libraries for lex and yacc might be needed for the compiler.

## Requirements for building from source
* GNU build tools: 
    * autoconf 2.65
    * automake 1.13
    * libtool 1.5.24
* pkg-config autoconf macros (pkg.m4)
* lex and yacc (developed primarily with flex and bison)
* libssl-dev

## Requirements for building the compiler from source on Windows
* Visual Studio C++
* Flex and Bison (e.g. the WinFlexBison package)

## Language requirements
These are only required if you choose to build the libraries for the given language

* C++
    * Boost 1.53.0
    * libevent (optional, to build the nonblocking server)
    * zlib (optional)
* Java
    * Java 1.7
    * Apache Ant
* C#: Mono 1.2.4 (and pkg-config to detect it) or Visual Studio 2005+
* Python 2.6 (including header files for extension modules)
* PHP 5.0 (optionally including header files for extension modules)
* Ruby 1.8
    * bundler gem
* Erlang R12 (R11 works but not recommended)
* Perl 5
    * Bit::Vector
    * Class::Accessor
* Haxe 3.1.3
* Go 1.4
* Delphi 2010
