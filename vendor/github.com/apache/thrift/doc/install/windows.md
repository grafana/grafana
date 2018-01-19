## Windows Setup

The Thrift environment consists of two main parts: The Thrift compiler EXE and the language-dependent libraries. Most of these libraries will require some kind of build and/or installation. But regarding the Thrift compiler utility there are a number of different alternatives. 

The first one of these alternatives is to download the **pre-built Thrift Compiler EXE** and only build the libraries needed from source, following one of the "Setup from source" methods outlined below.

The other two options are to build the Thrift compiler from source. The most recommended way to achieve this is by means of the **Visual Studio C++ build project**. Alternatively, the Thrift compiler can also be built via **Cygwin** or **MinGW** build environments, however this method is not only less comfortable, but more time-consuming and requires much more manual effort. 


## Prebuilt Thrift compiler

The windows Thrift compiler is available as a prebuilt exe available [here](/download). Note that there is no installation tool, rather this EXE file *is* already the Thrift compiler utility. Download the file and put it into some suitable location of your choice.

Now pick one of the "Build and install target libraries" below to continue.

 
## Setup from source via Visual Studio C++ (recommended)

### Requirements

Thrift's compiler is written in C++ and designed to be portable, but there are some system requirements. Thrift's runtime libraries are written in various languages, which are also required for the particular language interface.

 * Visual Studio C++, any recent version should do
 * Flex and Bison, e.g. the WinFlexBison package
 * [Apache Thrift Requirements](/docs/install)

### Build and install the compiler
 
After all requirements are in place, use the `compiler/cpp/compiler.vcxproj` build project to build the Thrift compiler. Copy the resulting EXE file to a location of your choice. 

### Build and install target libraries

A few of the target language libraries also do provide Visual Studio project files, such as C++ and C#. These are located in the `lib/<language>/` folders. 

Most of the language packages must be built and installed manually using build tools better suited to those languages. Typical examples are Java, Ruby, Delphi, or PHP. Look for the `README.md` file in the `lib/<language>/` folder for more details on how to build and install each language's library package.
 

## Setup from source via Cygwin

### Requirements

Thrift's compiler is written in C++ and designed to be portable, but there are some system requirements. Thrift's runtime libraries are written in various languages, which are also required for the particular language interface.

 * Cygwin or MinGW 
 * [Apache Thrift Requirements](/docs/install)

### Installing from source

If you are building from the first time out of the source repository, you will need to generate the configure scripts.  (This is not necessary if you downloaded a tarball.)  From the top directory, do:

	./bootstrap.sh

Once the configure scripts are generated, thrift can be configured. From the top directory, do:

	export CXXFLAGS="-D PTHREAD_MUTEX_RECURSIVE_NP=PTHREAD_MUTEX_RECURSIVE"
	./configure

Setting the CXXFLAGS environmental variable works around compile errors with PTHREAD_MUTEX_RECURSIVE_NP being undeclared, by replacing it with the newer, portable PTHREAD_MUTEX_RECURSIVE. (Tested on cygwin 20100320, Thrift r760184, latest pthread.)

**Optional:** You **may not** be able to make from the root  Thrift directory due to errors (see below to resolve). To make the compiler only, change to the compiler directory before running make:

	cd compiler/cpp

Now make the thrift compiler (& runtime libraries if make is run from the thrift root directory):

	make
	make install

### Build and install target libraries

Some language packages must be installed manually using build tools better suited to those languages. Typical examples are Java, Ruby, or PHP. Look for the README file in the `lib/<language>/` folder for more details on the installation of each language library package.

### Possible issues with Cygwin install

See also Possible issues with MinGW install.

#### Syntax error in ./configure

The following error occurs for some users when running ./configure:

	./configure: line 21183: syntax error near unexpected token `MONO,'
	./configure: line 21183: `  PKG_CHECK_MODULES(MONO, mono >= 1.2.6, have_mono=yes, have_mono=no)'

To resolve this, you'll need to find your pkg.m4 (installed by the pkg-config package) file and copy it to the thrift/aclocal directory.  From the top-level thrift directory, you can copy the file by running

	cp /usr/share/aclocal/pkg.m4 aclocal

Finally, re-run ./bootstrap.sh and ./configure.  (Note that pkg.m4 is created by the pkg-config tool.  If your /usr/share/aclocal directory doesn't contain the pkg.m4 file, you may not have pkg-config installed.)

#### Installing perl runtime libraries

Sometimes, there will be an error during the install of the perl libraries with chmod.

A workaround is to avoid installing the perl libraries if they are not needed.

If you don't need perl, run configure with --without-perl.

If you need perl, and are happy to manually install it, replace the contents of thrift/lib/perl/Makefile with the following, after building thrift:
	
	TODO

#### Linking to installed C++ runtime libraries

Sometimes, the installed libthrift.a will not link using g++, with linker errors about missing vtables and exceptions for Thrift classes.

A workaround is to link the compiled object files directly from your Thrift build, corresponding to the missing classes.

This can be implemented in a Makefile using the following lines:

	THRIFT_O=<path to>/thrift/lib/cpp
	LTHRIFT=$(THRIFT_O)/Thrift.o $(THRIFT_O)/TSocket.o $(THRIFT_O)/TBinaryProtocol.o $(THRIFT_O)/TBufferTransports.o

Then linking using $(LTHRIFT) instead of -lthrift.

	TODO - diagnose issue further

#### C++ runtime segfault with cygwin 1.7.5-1, g++-4.3.4, fork() and throw

If your thrift C++ programs segfault on throw after fork()ing, compile them with g++-3.

The issue and patch are described on the Cygwin mailing list at http://cygwin.com/ml/cygwin/2010-05/msg00203.html

This issue should be fixed in Cygwin versions after 1.7.5-1, or g++ 4.5.0.

## Setup from source via MinGW

### Requirements

To compile the Thrift generator & runtime libraries (untested) without the cygwin.dll dependency you need to install MinGW (www.mingw.org). 

 * MinGW 
 * [Apache Thrift Requirements](/docs/install)

In addition you need to add the following entry to your windows PATH variable.

	C:\MINGW\BIN
	
Next, open compiler/cpp/Makefile.am and add the following line to thrift_CXXFLAGS

	-DMINGW -mno-cygwin -lfl
	
Run bootstrap.sh:

	./bootstrap.sh

Make sure you have java in your $PATH variable, if not do(adjust path if necessary):

	export PATH=$PATH:"/cygdrive/c/program files/java/jre1.6.0_05/bin"

Run configure - using CXXFLAGS to work around an issue with an old pthreads define (untested on MinGW - works on Cygwin):

	export CXXFLAGS="-D PTHREAD_MUTEX_RECURSIVE_NP=PTHREAD_MUTEX_RECURSIVE"
	./configure

''Optional:'' To make the compiler only, change to the compiler  directory before running make:

	cd compiler/cpp
	
Run make:

	mingw32-make.exe

### Possible issues with MinGW install

See also Possible issues with Cygwin install, including the discussion about PTHREAD_MUTEX_RECURSIVE_NP.

#### yywrap is not found

Make sure you add -lfl in your cxxflags in Makefile, also try adding -Lc:/cygwin/libs

#### boost is not found

Try and change the include dir to use the windows path from c like this: Edit compiler/cpp/Makefile, look for the declaration of BOOST_CPPFLAGS, change that line for

	BOOST_CPPFLAGS = -Ic:/cygwin/usr/include/boost-1_53_0
	
#### realpath is not found

add -DMINGW -mno-cygwin to the CXXDEFS variable in Makefile

## Additional reading

For more information on the requirements see: [Apache Thrift Requirements](/docs/install)

For more information on building and installing Thrift see: [Building from source](/docs/BuildingFromSource)

