# ===========================================================================
#   http://www.gnu.org/software/autoconf-archive/ax_prog_haxe_version.html
# ===========================================================================
#
# SYNOPSIS
#
#   AX_PROG_HAXE_VERSION([VERSION],[ACTION-IF-TRUE],[ACTION-IF-FALSE])
#
# DESCRIPTION
#
#   Makes sure that haxe supports the version indicated. If true the shell
#   commands in ACTION-IF-TRUE are executed. If not the shell commands in
#   ACTION-IF-FALSE are run. The $HAXE_VERSION variable will be filled with
#   the detected version.
#
#   This macro uses the $HAXE variable to perform the check. If $HAXE is not
#   set prior to calling this macro, the macro will fail.
#
#   Example:
#
#     AC_PATH_PROG([HAXE],[haxe])
#     AC_PROG_HAXE_VERSION([3.1.3],[ ... ],[ ... ])
#
#   Searches for Haxe, then checks if at least version 3.1.3 is present.
#
# LICENSE
#
#   Copyright (c) 2015 Jens Geyer <jensg@apache.org>
#
#   Copying and distribution of this file, with or without modification, are
#   permitted in any medium without royalty provided the copyright notice
#   and this notice are preserved. This file is offered as-is, without any
#   warranty.

#serial 1

AC_DEFUN([AX_PROG_HAXE_VERSION],[
    AC_REQUIRE([AC_PROG_SED])

    AS_IF([test -n "$HAXE"],[
        ax_haxe_version="$1"

        AC_MSG_CHECKING([for haxe version])
        haxe_version=`$HAXE -version 2>&1 | $SED -e 's/^.* \( @<:@0-9@:>@*\.@<:@0-9@:>@*\.@<:@0-9@:>@*\) .*/\1/'`
        AC_MSG_RESULT($haxe_version)

	    AC_SUBST([HAXE_VERSION],[$haxe_version])

        AX_COMPARE_VERSION([$ax_haxe_version],[le],[$haxe_version],[
	    :
            $2
        ],[
	    :
            $3
        ])
    ],[
        AC_MSG_WARN([could not find Haxe])
        $3
    ])
])
