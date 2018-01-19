dnl @synopsis AX_LIB_ZLIB([MINIMUM-VERSION])
dnl
dnl Test for the libz library of a particular version (or newer).
dnl
dnl If no path to the installed zlib is given, the macro will first try
dnl using no -I or -L flags, then searches under /usr, /usr/local, /opt,
dnl and /opt/zlib.
dnl If these all fail, it will try the $ZLIB_ROOT environment variable.
dnl
dnl This macro calls:
dnl   AC_SUBST(ZLIB_CPPFLAGS)
dnl   AC_SUBST(ZLIB_LDFLAGS)
dnl   AC_SUBST(ZLIB_LIBS)
dnl
dnl And (if zlib is found):
dnl   AC_DEFINE(HAVE_ZLIB)
dnl
dnl It also leaves the shell variables "success" and "ax_have_zlib"
dnl set to "yes" or "no".
dnl
dnl NOTE: This macro does not currently work for cross-compiling,
dnl       but it can be easily modified to allow it.  (grep "cross").
dnl
dnl @category InstalledPackages
dnl @category C
dnl @version 2007-09-12
dnl @license AllPermissive
dnl
dnl Copyright (C) 2009 David Reiss
dnl Copying and distribution of this file, with or without modification,
dnl are permitted in any medium without royalty provided the copyright
dnl notice and this notice are preserved.

dnl Input: ax_zlib_path, WANT_ZLIB_VERSION
dnl Output: success=yes/no
AC_DEFUN([AX_LIB_ZLIB_DO_CHECK],
         [
          # Save our flags.
          CPPFLAGS_SAVED="$CPPFLAGS"
          LDFLAGS_SAVED="$LDFLAGS"
          LIBS_SAVED="$LIBS"
          LD_LIBRARY_PATH_SAVED="$LD_LIBRARY_PATH"

          # Set our flags if we are checking a specific directory.
          if test -n "$ax_zlib_path" ; then
            ZLIB_CPPFLAGS="-I$ax_zlib_path/include"
            ZLIB_LDFLAGS="-L$ax_zlib_path/lib"
            LD_LIBRARY_PATH="$ax_zlib_path/lib:$LD_LIBRARY_PATH"
          else
            ZLIB_CPPFLAGS=""
            ZLIB_LDFLAGS=""
          fi

          # Required flag for zlib.
          ZLIB_LIBS="-lz"

          # Prepare the environment for compilation.
          CPPFLAGS="$CPPFLAGS $ZLIB_CPPFLAGS"
          LDFLAGS="$LDFLAGS $ZLIB_LDFLAGS"
          LIBS="$LIBS $ZLIB_LIBS"
          export CPPFLAGS
          export LDFLAGS
          export LIBS
          export LD_LIBRARY_PATH

          success=no

          # Compile, link, and run the program.  This checks:
          # - zlib.h is available for including.
          # - zlibVersion() is available for linking.
          # - ZLIB_VERNUM is greater than or equal to the desired version.
          # - ZLIB_VERSION (defined in zlib.h) matches zlibVersion()
          #   (defined in the library).
          AC_LANG_PUSH([C])
          dnl This can be changed to AC_LINK_IFELSE if you are cross-compiling.
          AC_LINK_IFELSE([AC_LANG_PROGRAM([[
          #include <zlib.h>
          #if ZLIB_VERNUM >= 0x$WANT_ZLIB_VERSION
          #else
          # error zlib is too old
          #endif
          ]], [[
          const char* lib_version = zlibVersion();
          const char* hdr_version = ZLIB_VERSION;
          for (;;) {
            if (*lib_version != *hdr_version) {
              /* If this happens, your zlib header doesn't match your zlib */
              /* library.  That is really bad. */
              return 1;
            }
            if (*lib_version == '\0') {
              break;
            }
            lib_version++;
            hdr_version++;
          }
          return 0;
          ]])], [
          success=yes
          ])
          AC_LANG_POP([C])

          # Restore flags.
          CPPFLAGS="$CPPFLAGS_SAVED"
          LDFLAGS="$LDFLAGS_SAVED"
          LIBS="$LIBS_SAVED"
          LD_LIBRARY_PATH="$LD_LIBRARY_PATH_SAVED"
         ])


AC_DEFUN([AX_LIB_ZLIB],
         [

          dnl Allow search path to be overridden on the command line.
          AC_ARG_WITH([zlib],
                      AS_HELP_STRING([--with-zlib@<:@=DIR@:>@], [use zlib (default is yes) - it is possible to specify an alternate root directory for zlib]),
                      [
                       if test "x$withval" = "xno"; then
                         want_zlib="no"
                       elif test "x$withval" = "xyes"; then
                         want_zlib="yes"
                         ax_zlib_path=""
                       else
                         want_zlib="yes"
                         ax_zlib_path="$withval"
                       fi
                       ],
                       [want_zlib="yes" ; ax_zlib_path="" ])


          if test "$want_zlib" = "yes"; then
            # Parse out the version.
            zlib_version_req=ifelse([$1], ,1.2.3,$1)
            zlib_version_req_major=`expr $zlib_version_req : '\([[0-9]]*\)'`
            zlib_version_req_minor=`expr $zlib_version_req : '[[0-9]]*\.\([[0-9]]*\)'`
            zlib_version_req_patch=`expr $zlib_version_req : '[[0-9]]*\.[[0-9]]*\.\([[0-9]]*\)'`
            if test -z "$zlib_version_req_patch" ; then
              zlib_version_req_patch="0"
            fi
            WANT_ZLIB_VERSION=`expr $zlib_version_req_major \* 1000 \+  $zlib_version_req_minor \* 100 \+ $zlib_version_req_patch \* 10`

            AC_MSG_CHECKING(for zlib >= $zlib_version_req)

            # Run tests.
            if test -n "$ax_zlib_path"; then
              AX_LIB_ZLIB_DO_CHECK
            else
              for ax_zlib_path in "" /usr /usr/local /opt /opt/zlib "$ZLIB_ROOT" ; do
                AX_LIB_ZLIB_DO_CHECK
                if test "$success" = "yes"; then
                  break;
                fi
              done
            fi

            if test "$success" != "yes" ; then
              AC_MSG_RESULT(no)
              ZLIB_CPPFLAGS=""
              ZLIB_LDFLAGS=""
              ZLIB_LIBS=""
            else
              AC_MSG_RESULT(yes)
              AC_DEFINE(HAVE_ZLIB,,[define if zlib is available])
            fi

            ax_have_zlib="$success"

            AC_SUBST(ZLIB_CPPFLAGS)
            AC_SUBST(ZLIB_LDFLAGS)
            AC_SUBST(ZLIB_LIBS)
          fi

          ])
