dnl @synopsis AX_JAVAC_AND_JAVA
dnl @synopsis AX_CHECK_JAVA_CLASS(CLASSNAME)
dnl
dnl Test for the presence of a JDK, and (optionally) specific classes.
dnl
dnl If "JAVA" is defined in the environment, that will be the only
dnl java command tested.  Otherwise, a hard-coded list will be used.
dnl Similarly for "JAVAC".
dnl
dnl AX_JAVAC_AND_JAVA does not currently support testing for a particular
dnl Java version, testing for only one of "java" and "javac", or
dnl compiling or running user-provided Java code.
dnl
dnl After AX_JAVAC_AND_JAVA runs, the shell variables "success" and
dnl "ax_javac_and_java" are set to "yes" or "no", and "JAVAC" and
dnl "JAVA" are set to the appropriate commands.
dnl
dnl AX_CHECK_JAVA_CLASS must be run after AX_JAVAC_AND_JAVA.
dnl It tests for the presence of a class based on a fully-qualified name.
dnl It sets the shell variable "success" to "yes" or "no".
dnl
dnl @category Java
dnl @version 2009-02-09
dnl @license AllPermissive
dnl
dnl Copyright (C) 2009 David Reiss
dnl Copying and distribution of this file, with or without modification,
dnl are permitted in any medium without royalty provided the copyright
dnl notice and this notice are preserved.


AC_DEFUN([AX_JAVAC_AND_JAVA],
         [

          dnl Hard-coded default commands to test.
          JAVAC_PROGS="javac,jikes,gcj -C"
          JAVA_PROGS="java,kaffe"

          dnl Allow the user to specify an alternative.
          if test -n "$JAVAC" ; then
            JAVAC_PROGS="$JAVAC"
          fi
          if test -n "$JAVA" ; then
            JAVA_PROGS="$JAVA"
          fi

          AC_MSG_CHECKING(for javac and java)

          echo "public class configtest_ax_javac_and_java { public static void main(String args@<:@@:>@) { } }" > configtest_ax_javac_and_java.java
          success=no
          oIFS="$IFS"

          IFS=","
          for JAVAC in $JAVAC_PROGS ; do
            IFS="$oIFS"

            echo "Running \"$JAVAC configtest_ax_javac_and_java.java\"" >&AS_MESSAGE_LOG_FD
            if $JAVAC configtest_ax_javac_and_java.java >&AS_MESSAGE_LOG_FD 2>&1 ; then

              # prevent $JAVA VM issues with UTF-8 path names (THRIFT-3271)
              oLC_ALL="$LC_ALL"
              LC_ALL=""

              IFS=","
              for JAVA in $JAVA_PROGS ; do
                IFS="$oIFS"

                echo "Running \"$JAVA configtest_ax_javac_and_java\"" >&AS_MESSAGE_LOG_FD
                if $JAVA configtest_ax_javac_and_java >&AS_MESSAGE_LOG_FD 2>&1 ; then
                  success=yes
                  break 2
                fi

              done

              # restore LC_ALL
              LC_ALL="$oLC_ALL"
              oLC_ALL=""

            fi

          done

          rm -f configtest_ax_javac_and_java.java configtest_ax_javac_and_java.class

          if test "$success" != "yes" ; then
            AC_MSG_RESULT(no)
            JAVAC=""
            JAVA=""
          else
            AC_MSG_RESULT(yes)
          fi

          ax_javac_and_java="$success"

          ])


AC_DEFUN([AX_CHECK_JAVA_CLASS],
         [
          AC_MSG_CHECKING(for Java class [$1])

          echo "import $1; public class configtest_ax_javac_and_java { public static void main(String args@<:@@:>@) { } }" > configtest_ax_javac_and_java.java

          echo "Running \"$JAVAC configtest_ax_javac_and_java.java\"" >&AS_MESSAGE_LOG_FD
          if $JAVAC configtest_ax_javac_and_java.java >&AS_MESSAGE_LOG_FD 2>&1 ; then
            AC_MSG_RESULT(yes)
            success=yes
          else
            AC_MSG_RESULT(no)
            success=no
          fi

          rm -f configtest_ax_javac_and_java.java configtest_ax_javac_and_java.class
          ])


AC_DEFUN([AX_CHECK_ANT_VERSION],
         [
          AC_MSG_CHECKING(for ant version > $2)
          ANT_VALID=`expr $($1 -version 2>/dev/null | sed -n 's/.*version \(@<:@0-9\.@:>@*\).*/\1/p') \>= $2`
          if test "x$ANT_VALID" = "x1" ; then
            AC_MSG_RESULT(yes)
          else
            AC_MSG_RESULT(no)
            ANT=""
          fi
          ])

