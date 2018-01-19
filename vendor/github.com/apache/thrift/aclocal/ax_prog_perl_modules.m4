# ===========================================================================
#   http://www.gnu.org/software/autoconf-archive/ax_prog_perl_modules.html
# ===========================================================================
#
# SYNOPSIS
#
#   AX_PROG_PERL_MODULES([MODULES], [ACTION-IF-TRUE], [ACTION-IF-FALSE])
#
# DESCRIPTION
#
#   Checks to see if the given perl modules are available. If true the shell
#   commands in ACTION-IF-TRUE are executed. If not the shell commands in
#   ACTION-IF-FALSE are run. Note if $PERL is not set (for example by
#   calling AC_CHECK_PROG, or AC_PATH_PROG), AC_CHECK_PROG(PERL, perl, perl)
#   will be run.
#
#   MODULES is a space separated list of module names. To check for a
#   minimum version of a module, append the version number to the module
#   name, separated by an equals sign.
#
#   Example:
#
#     AX_PROG_PERL_MODULES( Text::Wrap Net::LDAP=1.0.3, ,
#                           AC_MSG_WARN(Need some Perl modules)
#
# LICENSE
#
#   Copyright (c) 2009 Dean Povey <povey@wedgetail.com>
#
#   Copying and distribution of this file, with or without modification, are
#   permitted in any medium without royalty provided the copyright notice
#   and this notice are preserved. This file is offered as-is, without any
#   warranty.

#serial 7

AU_ALIAS([AC_PROG_PERL_MODULES], [AX_PROG_PERL_MODULES])
AC_DEFUN([AX_PROG_PERL_MODULES],[dnl

m4_define([ax_perl_modules])
m4_foreach([ax_perl_module], m4_split(m4_normalize([$1])),
	  [
	   m4_append([ax_perl_modules],
		     [']m4_bpatsubst(ax_perl_module,=,[ ])[' ])
          ])

# Make sure we have perl
if test -z "$PERL"; then
AC_CHECK_PROG(PERL,perl,perl)
fi

if test "x$PERL" != x; then
  ax_perl_modules_failed=0
  for ax_perl_module in ax_perl_modules; do
    AC_MSG_CHECKING(for perl module $ax_perl_module)

    # Would be nice to log result here, but can't rely on autoconf internals
    $PERL -e "use $ax_perl_module; exit" > /dev/null 2>&1
    if test $? -ne 0; then
      AC_MSG_RESULT(no);
      ax_perl_modules_failed=1
   else
      AC_MSG_RESULT(ok);
    fi
  done

  # Run optional shell commands
  if test "$ax_perl_modules_failed" = 0; then
    :
    $2
  else
    :
    $3
  fi
else
  AC_MSG_WARN(could not find perl)
fi])dnl
