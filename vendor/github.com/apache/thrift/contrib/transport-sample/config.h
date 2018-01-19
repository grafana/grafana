//Missing definitions for *NIX systems. This sample project
//was initially created on Windows.

#include <unistd.h>
#include <stdlib.h>
#include <string.h>

#define TEXT(str) str

inline int Sleep(int ms)
{
	return sleep(ms/1000); //sleep() param is in seconds
}

inline int _tcscmp(const char* str1, const char* str2)
{
	return strcmp(str1, str2);
}

inline int _tstoi(const char* str)
{
	return atoi(str);
}

