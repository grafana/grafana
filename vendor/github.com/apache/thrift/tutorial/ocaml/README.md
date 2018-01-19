
This is the ocaml tutorial example.  It assumes that you've already
built and installed the thrift ocaml runtime libraries in lib/ocaml.

To compile this, you will need to generate the Thrift sources for
ocaml in this directory (due to limitations in the OASIS build-tool):

  % thrift -r --gen ocaml ../tutorial.thrift
  % oasis setup
  % make

This will produce two executables Calc{Server,Client}.<type> where
<type> is one of "byte" or "native", depending on your ocaml
installation.  Just run the server in the background, then the client
(as you would do for the C++ example).
