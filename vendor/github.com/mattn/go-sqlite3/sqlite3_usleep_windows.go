// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build cgo

package sqlite3

// usleep is a function available on *nix based systems.
// This function is not present in Windows.
// Windows has a sleep function but this works with seconds
// and not with microseconds as usleep.
//
// This code should improve performance on windows because
// without the presence of usleep SQLite waits 1 second.
//
// Source:  https://github.com/php/php-src/blob/PHP-5.0/win32/time.c
// License: https://github.com/php/php-src/blob/PHP-5.0/LICENSE
// Details: https://stackoverflow.com/questions/5801813/c-usleep-is-obsolete-workarounds-for-windows-mingw?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa

/*
#include <windows.h>

void usleep(__int64 usec)
{
    HANDLE timer;
    LARGE_INTEGER ft;

    // Convert to 100 nanosecond interval, negative value indicates relative time
    ft.QuadPart = -(10*usec);

    timer = CreateWaitableTimer(NULL, TRUE, NULL);
    SetWaitableTimer(timer, &ft, 0, NULL, NULL, 0);
    WaitForSingleObject(timer, INFINITE);
    CloseHandle(timer);
}
*/
import "C"

// EOF
