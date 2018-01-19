Thrift transport sample project
-------------------------------

This cross-platform project has been built with Windows Visual Studio 10 and 
OSX 10.7.1's g++.  The client and server support socket and pipe transports 
through command-line switches.

Windows supports both named & anonymous pipes; *NIX gets only named 
'pipes' at this time.

Windows-only at this time:
The client & server are double-ended. Both sides run a server and client to 
enable full duplex bidirectional event signaling. They are simple command 
line apps. The server runs until it's aborted (Ctl-C). The client connects to
the server, informs the server of its listening pipe/port, runs some more RPCs 
and exits. The server also makes RPC calls to the client to demonstrate 
bidirectional operation.

Prequisites:
Boost -- tested with Boost 1.47, other versions may work.
libthrift library -- build the library under "thrift/lib/cpp/"
thrift IDL compiler -- download from http://thrift.apache.org/download/ 
   or build from "thrift/compiler/cpp".  The IDL compiler version should
   match the thrift source distribution's version. For instance, thrift-0.9.0
   has a different directory structure than thrift-0.8.0 and the generated
   files are not compatible.

Note: Bulding the thrift IDL compiler and library are beyond the scope
of this article. Please refer to the Thrift documentation in the respective
directories and online.


Microsoft Windows with Visual Studio 10
----------------------------------------
Copy the IDL compiler 'thrift.exe' to this project folder or to a location in the path.
Run thriftme.bat to generate the interface source from the thrift files.

Open transport-sample.sln and...
Adapt the Boost paths for the client and server projects. Right-click on each project, select
Properties, then:
Configuration Properties -> C/C++ -> General -> Additional Include Directories
Configuration Properties -> Linker -> General -> Additional Include Directories

The stock path assumes that Boost is located at the same level as the thrift repo root.

Run the following in separate command prompts from the Release or Debug 
build folder:
 server.exe -np test
 client.exe -np test


*NIX flavors
------------
Build the thrift cpp library.
Build the IDL compiler and copy it to this project folder.
Run thriftme.sh to generate the interface source from the thrift files.
Run 'make'

Run the following in separate shells:
 server/server -np /tmp/test
 client/client -np /tmp/test
