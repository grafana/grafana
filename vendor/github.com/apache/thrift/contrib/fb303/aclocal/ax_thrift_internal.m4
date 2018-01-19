dnl @synopsis AX_THRIFT_GEN(SHORT_LANGUAGE, LONG_LANGUAGE, DEFAULT)
dnl @synopsis AX_THRIFT_LIB(SHORT_LANGUAGE, LONG_LANGUAGE, DEFAULT)
dnl
dnl Allow a particular language generator to be disabled.
dnl Allow a particular language library to be disabled.
dnl
dnl These macros have poor error handling and are poorly documented.
dnl They are intended only for internal use by the Thrift compiler.
dnl
dnl @version 2008-02-20
dnl @license AllPermissive
dnl
dnl Copyright (C) 2009 David Reiss
dnl Copying and distribution of this file, with or without modification,
dnl are permitted in any medium without royalty provided the copyright
dnl notice and this notice are preserved.

AC_DEFUN([AX_THRIFT_LIB],
         [
          AC_ARG_WITH($1,
                      AC_HELP_STRING([--with-$1], [build the $2 library @<:@default=$3@:>@]),
                      [with_$1="$withval"],
                      [with_$1=$3]
                      )
          have_$1=no
          dnl What we do here is going to vary from library to library,
          dnl so we can't really generalize (yet!).
         ])
