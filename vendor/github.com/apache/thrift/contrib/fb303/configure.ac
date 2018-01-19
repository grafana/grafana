# Autoconf input file
# $Id$

# AC - autoconf
# FB - facebook

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

#########################################################################
# DO NOT TOUCH EXCEPT TO CHANGE REV# IN AC_INIT

AC_PREREQ(2.52)
AC_INIT([libfb303],[20080209])
#AC_CONFIG_AUX_DIR([/usr/share/automake-1.9])
# To install locally
FB_INITIALIZE([localinstall])
AC_PREFIX_DEFAULT([/usr/local])

############################################################################
# User Configurable. Change With CAUTION!
# User can include custom makefile rules. Uncomment and update only <name> in PRODUCT_MK.
# Include where appropriate in any Makefile.am as @PRODUCT_MK@

#PRODUCT_MK="include ${EXTERNAL_PATH}/shared/build/<name>.mk"

# Default path to external Facebook components and shared build toools I.e fb303 etc.
# To point to other locations set  environment variable EXTERNAL_PATH.
# To change the current default you must change bootstrap.sh.
FB_WITH_EXTERNAL_PATH([`pwd`])

AC_ARG_VAR([PY_PREFIX], [Prefix for installing Python modules.
                         (Normal --prefix is ignored for Python because
                         Python has different conventions.)
                         Default = "/usr"])
AS_IF([test "x$PY_PREFIX" = x], [PY_PREFIX="/usr"])

##########################################################################
# User Configurable

# Pre-defined macro to set opt build mode. Run with --disable-shared option to turn off optimization.
FB_ENABLE_DEFAULT_OPT_BUILD

# Predefined macro to set static library mode. Run with --disable-static option to turn off static lib mode.
FB_ENABLE_DEFAULT_STATIC

# Personalized feature generator. Creates defines/conditionals and --enable --disable command line options.
# FB_ENABLE_FEATURE([FEATURE], [feature]) OR FB_ENABLE_FEATURE([FEATURE], [feature], [\"<value>\"])

# Example: Macro supplies -DFACEBOOK at compile time and "if FACEBOOK endif" capabilities.

# Personalized path generator Sets default paths. Provides --with-xx=DIR options.
# FB_WITH_PATH([<var>_home], [<var>path], [<default location>]

# Example: sets $(thrift_home) variable with default path set to /usr/local.
FB_WITH_PATH([thrift_home], [thriftpath], [/usr/local])

AX_CXX_COMPILE_STDCXX_11([noext])
AX_THRIFT_LIB(cpp, [C++], yes)
have_cpp=no
if test "$with_cpp" = "yes"; then
  # Require boost 1.40.0 or later
  AX_BOOST_BASE([1.40.0])
  if test "x$succeeded" = "xyes"; then
    have_cpp="yes"
  fi
fi
AM_CONDITIONAL([WITH_CPP], [test "$have_cpp" = "yes"])

AX_THRIFT_LIB(java, [Java], yes)
if test "$with_java" = "yes"; then
  AX_JAVAC_AND_JAVA
  AC_PATH_PROG([ANT], [ant])
  AX_CHECK_ANT_VERSION($ANT, 1.7)
  AC_SUBST(CLASSPATH)
  AC_SUBST(ANT_FLAGS)
  if test "x$JAVAC" != "x" && test "x$JAVAC" != "x" && test "x$ANT" != "x" ; then
    have_java="yes"
  fi
fi
AM_CONDITIONAL(WITH_JAVA, [test "$have_java" = "yes"])

AX_THRIFT_LIB(php, [PHP], yes)
if test "$with_php" = "yes"; then
  AC_PATH_PROG([PHP], [php])
  if test "x$PHP" != "x" && test "x$PHP" != "x:" ; then
    have_php="yes"
  fi
fi
AM_CONDITIONAL(WITH_PHP, [test "$have_php" = "yes"])

AX_THRIFT_LIB(python, [Python], yes)
if test "$with_python" = "yes"; then
  AM_PATH_PYTHON(2.4,, :)
  if test "x$PYTHON" != "x" && test "x$PYTHON" != "x:" ; then
    have_python="yes"
  fi
fi
AM_CONDITIONAL(WITH_PYTHON, [test "$have_python" = "yes"])

# Generates Makefile from Makefile.am. Modify when new subdirs are added.
# Change Makefile.am also to add subdirectly.
AC_CONFIG_FILES(Makefile cpp/Makefile py/Makefile)

# Check for headers
AC_CHECK_HEADERS([inttypes.h])
AC_CHECK_HEADERS([netinet/in.h])

############################################################################
# DO NOT TOUCH.

AC_SUBST(PRODUCT_MK)
AC_OUTPUT

#############################################################################
######### FINISH ############################################################

echo "EXTERNAL_PATH $EXTERNAL_PATH"
echo
echo "Building C++ Library ......... : $have_cpp"
echo "Building Java Library ........ : $have_java"
echo "Building Python Library ...... : $have_python"
echo "Building PHP Library ......... : $have_php"


#
# NOTES FOR USER
# Short cut to create conditional flags.
#enable_facebook="yes"
#AM_CONDITIONAL([FACEBOOK], [test "$enable_facebook" = yes])
#enable_hdfs="yes"
#AM_CONDITIONAL([HDFS], [test "$enable_hdfs" = yes])

# Enable options with --enable and --disable configurable.
#AC_MSG_CHECKING([whether to enable FACEBOOK])
#FACEBOOK=""
#AC_ARG_ENABLE([facebook],
#  [  --enable-facebook     Enable facebook.],
#  [
#     ENABLE_FACEBOOK=$enableval
#  ],
#  [
#     ENABLE_FACEBOOK="no"
#  ]
#)
#AM_CONDITIONAL([FACEBOOK], [test "$ENABLE_FACEBOOK" = yes])
#AC_MSG_RESULT($ENABLE_FACEBOOK)

