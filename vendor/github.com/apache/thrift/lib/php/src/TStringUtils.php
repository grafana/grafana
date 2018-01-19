<?php

interface TStringFunc
{
    public function substr($str, $start, $length = null);
    public function strlen($str);
}

class TStringFunc_Core
implements TStringFunc {
    public function substr($str, $start, $length = null)
    {
        // specifying a null $length would return an empty string
        if ($length === null) {
            return substr($str, $start);
        }

        return substr($str, $start, $length);
    }

    public function strlen($str)
    {
        return strlen($str);
    }
}

class TStringFunc_Mbstring
implements TStringFunc {
    public function substr($str, $start, $length = null)
    {
        /**
         * We need to set the charset parameter, which is the second
         * optional parameter and the first optional parameter can't
         * be null or false as a "magic" value because that would
         * cause an empty string to be returned, so we need to
         * actually calculate the proper length value.
         */
        if ($length === null) {
            $length = $this->strlen($str) - $start;
        }

        return mb_substr($str, $start, $length, '8bit');
    }

    public function strlen($str)
    {
        return mb_strlen($str, '8bit');
    }
}

class TStringFuncFactory
{
    private static $_instance;

    /**
     * Get the Singleton instance of TStringFunc implementation that is
     * compatible with the current system's mbstring.func_overload settings.
     *
     * @return TStringFunc
     */
    public static function create()
    {
        if (!self::$_instance) {
            self::_setInstance();
        }

        return self::$_instance;
    }

    private static function _setInstance()
    {
        /**
         * Cannot use str* functions for byte counting because multibyte
         * characters will be read a single bytes.
         *
         * See: http://us.php.net/manual/en/mbstring.overload.php
         */
        if (ini_get('mbstring.func_overload') & 2) {
            self::$_instance = new TStringFunc_Mbstring();
        }
        /**
         * mbstring is not installed or does not have function overloading
         * of the str* functions enabled so use PHP core str* functions for
         * byte counting.
         */
        else {
            self::$_instance = new TStringFunc_Core();
        }
    }
}
