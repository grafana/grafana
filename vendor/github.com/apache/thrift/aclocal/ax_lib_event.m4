dnl @synopsis AX_LIB_EVENT([MINIMUM-VERSION])
dnl
dnl Test for the libevent library of a particular version (or newer).
dnl
dnl If no path to the installed libevent is given, the macro will first try
dnl using no -I or -L flags, then searches under /usr, /usr/local, /opt,
dnl and /opt/libevent.
dnl If these all fail, it will try the $LIBEVENT_ROOT environment variable.
dnl
dnl This macro requires that #include <sys/types.h> works and defines u_char.
dnl
dnl This macro calls:
dnl   AC_SUBST(LIBEVENT_CPPFLAGS)
dnl   AC_SUBST(LIBEVENT_LDFLAGS)
dnl   AC_SUBST(LIBEVENT_LIBS)
dnl
dnl And (if libevent is found):
dnl   AC_DEFINE(HAVE_LIBEVENT)
dnl
dnl It also leaves the shell variables "success" and "ax_have_libevent"
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

dnl Input: ax_libevent_path, WANT_LIBEVENT_VERSION
dnl Output: success=yes/no
AC_DEFUN([AX_LIB_EVENT_DO_CHECK],
         [
          # Save our flags.
          CPPFLAGS_SAVED="$CPPFLAGS"
          LDFLAGS_SAVED="$LDFLAGS"
          LIBS_SAVED="$LIBS"
          LD_LIBRARY_PATH_SAVED="$LD_LIBRARY_PATH"

          # Set our flags if we are checking a specific directory.
          if test -n "$ax_libevent_path" ; then
            LIBEVENT_CPPFLAGS="-I$ax_libevent_path/include"
            LIBEVENT_LDFLAGS="-L$ax_libevent_path/lib"
            LD_LIBRARY_PATH="$ax_libevent_path/lib:$LD_LIBRARY_PATH"
          else
            LIBEVENT_CPPFLAGS=""
            LIBEVENT_LDFLAGS=""
          fi

          # Required flag for libevent.
          LIBEVENT_LIBS="-levent"

          # Prepare the environment for compilation.
          CPPFLAGS="$CPPFLAGS $LIBEVENT_CPPFLAGS"
          LDFLAGS="$LDFLAGS $LIBEVENT_LDFLAGS"
          LIBS="$LIBS $LIBEVENT_LIBS"
          export CPPFLAGS
          export LDFLAGS
          export LIBS
          export LD_LIBRARY_PATH

          success=no

          # Compile, link, and run the program.  This checks:
          # - event.h is available for including.
          # - event_get_version() is available for linking.
          # - The event version string is lexicographically greater
          #   than the required version.
          AC_LANG_PUSH([C])
          dnl This can be changed to AC_LINK_IFELSE if you are cross-compiling,
          dnl but then the version cannot be checked.
          AC_LINK_IFELSE([AC_LANG_PROGRAM([[
          #include <sys/types.h>
          #include <event.h>
          ]], [[
          const char* lib_version = event_get_version();
          const char* wnt_version = "$WANT_LIBEVENT_VERSION";
          int lib_digits;
          int wnt_digits;
          for (;;) {
            /* If we reached the end of the want version.  We have it. */
            if (*wnt_version == '\0' || *wnt_version == '-') {
              return 0;
            }
            /* If the want version continues but the lib version does not, */
            /* we are missing a letter.  We don't have it. */
            if (*lib_version == '\0' || *lib_version == '-') {
              return 1;
            }
            /* In the 1.4 version numbering style, if there are more digits */
            /* in one version than the other, that one is higher. */
            for (lib_digits = 0;
                lib_version[lib_digits] >= '0' &&
                lib_version[lib_digits] <= '9';
                lib_digits++)
              ;
            for (wnt_digits = 0;
                wnt_version[wnt_digits] >= '0' &&
                wnt_version[wnt_digits] <= '9';
                wnt_digits++)
              ;
            if (lib_digits > wnt_digits) {
              return 0;
            }
            if (lib_digits < wnt_digits) {
              return 1;
            }
            /* If we have greater than what we want.  We have it. */
            if (*lib_version > *wnt_version) {
              return 0;
            }
            /* If we have less, we don't. */
            if (*lib_version < *wnt_version) {
              return 1;
            }
            lib_version++;
            wnt_version++;
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


AC_DEFUN([AX_LIB_EVENT],
         [

          dnl Allow search path to be overridden on the command line.
          AC_ARG_WITH([libevent],
                      AS_HELP_STRING([--with-libevent@<:@=DIR@:>@], [use libevent [default=yes]. Optionally specify the root prefix dir where libevent is installed]),
                      [
                       if test "x$withval" = "xno"; then
                         want_libevent="no"
                       elif test "x$withval" = "xyes"; then
                         want_libevent="yes"
                         ax_libevent_path=""
                       else
                         want_libevent="yes"
                         ax_libevent_path="$withval"
                       fi
                       ],
                       [ want_libevent="yes" ; ax_libevent_path="" ])


          if test "$want_libevent" = "yes"; then
            WANT_LIBEVENT_VERSION=ifelse([$1], ,1.2,$1)

            AC_MSG_CHECKING(for libevent >= $WANT_LIBEVENT_VERSION)

            # Run tests.
            if test -n "$ax_libevent_path"; then
              AX_LIB_EVENT_DO_CHECK
            else
              for ax_libevent_path in "" $lt_sysroot/usr $lt_sysroot/usr/local $lt_sysroot/opt $lt_sysroot/opt/local $lt_sysroot/opt/libevent "$LIBEVENT_ROOT" ; do
                AX_LIB_EVENT_DO_CHECK
                if test "$success" = "yes"; then
                  break;
                fi
              done
            fi

            if test "$success" != "yes" ; then
              AC_MSG_RESULT(no)
              LIBEVENT_CPPFLAGS=""
              LIBEVENT_LDFLAGS=""
              LIBEVENT_LIBS=""
            else
              AC_MSG_RESULT(yes)
              AC_DEFINE(HAVE_LIBEVENT,,[define if libevent is available])
              ax_have_libevent_[]m4_translit([$1], [.], [_])="yes"
            fi

            ax_have_libevent="$success"

            AC_SUBST(LIBEVENT_CPPFLAGS)
            AC_SUBST(LIBEVENT_LDFLAGS)
            AC_SUBST(LIBEVENT_LIBS)
          fi

          ])
