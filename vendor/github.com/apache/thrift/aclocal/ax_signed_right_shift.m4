dnl @synopsis AX_SIGNED_RIGHT_SHIFT
dnl
dnl Tests the behavior of a right shift on a negative signed int.
dnl
dnl This macro calls:
dnl   AC_DEFINE(SIGNED_RIGHT_SHIFT_IS)
dnl   AC_DEFINE(ARITHMETIC_RIGHT_SHIFT)
dnl   AC_DEFINE(LOGICAL_RIGHT_SHIFT)
dnl   AC_DEFINE(UNKNOWN_RIGHT_SHIFT)
dnl
dnl SIGNED_RIGHT_SHIFT_IS will be equal to one of the other macros.
dnl It also leaves the shell variables "ax_signed_right_shift"
dnl set to "arithmetic", "logical", or "unknown".
dnl
dnl NOTE: This macro does not work for cross-compiling.
dnl
dnl @category C
dnl @version 2009-03-25
dnl @license AllPermissive
dnl
dnl Copyright (C) 2009 David Reiss
dnl Copying and distribution of this file, with or without modification,
dnl are permitted in any medium without royalty provided the copyright
dnl notice and this notice are preserved.

AC_DEFUN([AX_SIGNED_RIGHT_SHIFT],
         [

          AC_MSG_CHECKING(the behavior of a signed right shift)

          success_arithmetic=no
          AC_RUN_IFELSE([AC_LANG_PROGRAM([[]], [[
          return
            /* 0xffffffff */
            -1 >>  1 != -1 ||
            -1 >>  2 != -1 ||
            -1 >>  3 != -1 ||
            -1 >>  4 != -1 ||
            -1 >>  8 != -1 ||
            -1 >> 16 != -1 ||
            -1 >> 24 != -1 ||
            -1 >> 31 != -1 ||
            /* 0x80000000 */
            (-2147483647 - 1) >>  1 != -1073741824 ||
            (-2147483647 - 1) >>  2 != -536870912  ||
            (-2147483647 - 1) >>  3 != -268435456  ||
            (-2147483647 - 1) >>  4 != -134217728  ||
            (-2147483647 - 1) >>  8 != -8388608    ||
            (-2147483647 - 1) >> 16 != -32768      ||
            (-2147483647 - 1) >> 24 != -128        ||
            (-2147483647 - 1) >> 31 != -1          ||
            /* 0x90800000 */
            -1870659584 >>  1 != -935329792 ||
            -1870659584 >>  2 != -467664896 ||
            -1870659584 >>  3 != -233832448 ||
            -1870659584 >>  4 != -116916224 ||
            -1870659584 >>  8 != -7307264   ||
            -1870659584 >> 16 != -28544     ||
            -1870659584 >> 24 != -112       ||
            -1870659584 >> 31 != -1         ||
            0;
          ]])], [
          success_arithmetic=yes
          ])


          success_logical=no
          AC_RUN_IFELSE([AC_LANG_PROGRAM([[]], [[
          return
            /* 0xffffffff */
            -1 >>  1 != (signed)((unsigned)-1 >>  1) ||
            -1 >>  2 != (signed)((unsigned)-1 >>  2) ||
            -1 >>  3 != (signed)((unsigned)-1 >>  3) ||
            -1 >>  4 != (signed)((unsigned)-1 >>  4) ||
            -1 >>  8 != (signed)((unsigned)-1 >>  8) ||
            -1 >> 16 != (signed)((unsigned)-1 >> 16) ||
            -1 >> 24 != (signed)((unsigned)-1 >> 24) ||
            -1 >> 31 != (signed)((unsigned)-1 >> 31) ||
            /* 0x80000000 */
            (-2147483647 - 1) >>  1 != (signed)((unsigned)(-2147483647 - 1) >>  1) ||
            (-2147483647 - 1) >>  2 != (signed)((unsigned)(-2147483647 - 1) >>  2) ||
            (-2147483647 - 1) >>  3 != (signed)((unsigned)(-2147483647 - 1) >>  3) ||
            (-2147483647 - 1) >>  4 != (signed)((unsigned)(-2147483647 - 1) >>  4) ||
            (-2147483647 - 1) >>  8 != (signed)((unsigned)(-2147483647 - 1) >>  8) ||
            (-2147483647 - 1) >> 16 != (signed)((unsigned)(-2147483647 - 1) >> 16) ||
            (-2147483647 - 1) >> 24 != (signed)((unsigned)(-2147483647 - 1) >> 24) ||
            (-2147483647 - 1) >> 31 != (signed)((unsigned)(-2147483647 - 1) >> 31) ||
            /* 0x90800000 */
            -1870659584 >>  1 != (signed)((unsigned)-1870659584 >>  1) ||
            -1870659584 >>  2 != (signed)((unsigned)-1870659584 >>  2) ||
            -1870659584 >>  3 != (signed)((unsigned)-1870659584 >>  3) ||
            -1870659584 >>  4 != (signed)((unsigned)-1870659584 >>  4) ||
            -1870659584 >>  8 != (signed)((unsigned)-1870659584 >>  8) ||
            -1870659584 >> 16 != (signed)((unsigned)-1870659584 >> 16) ||
            -1870659584 >> 24 != (signed)((unsigned)-1870659584 >> 24) ||
            -1870659584 >> 31 != (signed)((unsigned)-1870659584 >> 31) ||
            0;
          ]])], [
          success_logical=yes
          ])


          AC_DEFINE([ARITHMETIC_RIGHT_SHIFT], 1, [Possible value for SIGNED_RIGHT_SHIFT_IS])
          AC_DEFINE([LOGICAL_RIGHT_SHIFT], 2, [Possible value for SIGNED_RIGHT_SHIFT_IS])
          AC_DEFINE([UNKNOWN_RIGHT_SHIFT], 3, [Possible value for SIGNED_RIGHT_SHIFT_IS])

          if test "$success_arithmetic" = "yes" && test "$success_logical" = "yes" ; then
            AC_MSG_ERROR("Right shift appears to be both arithmetic and logical!")
          elif test "$success_arithmetic" = "yes" ; then
            ax_signed_right_shift=arithmetic
            AC_DEFINE([SIGNED_RIGHT_SHIFT_IS], 1,
                      [Indicates the effect of the right shift operator
                       on negative signed integers])
          elif test "$success_logical" = "yes" ; then
            ax_signed_right_shift=logical
            AC_DEFINE([SIGNED_RIGHT_SHIFT_IS], 2,
                      [Indicates the effect of the right shift operator
                       on negative signed integers])
          else
            ax_signed_right_shift=unknown
            AC_DEFINE([SIGNED_RIGHT_SHIFT_IS], 3,
                      [Indicates the effect of the right shift operator
                       on negative signed integers])
          fi

          AC_MSG_RESULT($ax_signed_right_shift)
         ])
