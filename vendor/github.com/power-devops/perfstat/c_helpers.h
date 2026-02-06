#ifndef C_HELPERS_H
#define C_HELPERS_H

#include <sys/types.h>
#include <sys/mntctl.h>
#include <sys/vmount.h>
#include <sys/statfs.h>
#include <libperfstat.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <utmpx.h>

#define GETFUNC(TYPE) perfstat_##TYPE##_t *get_##TYPE##_stat(perfstat_##TYPE##_t *b, int n) { \
        if (!b) return NULL; \
        return &(b[n]); \
}

#define GETFUNC_EXT(TYPE) extern perfstat_##TYPE##_t *get_##TYPE##_stat(perfstat_##TYPE##_t *, int);

GETFUNC_EXT(cpu)
GETFUNC_EXT(disk)
GETFUNC_EXT(diskadapter)
GETFUNC_EXT(diskpath)
GETFUNC_EXT(fcstat)
GETFUNC_EXT(logicalvolume)
GETFUNC_EXT(memory_page)
GETFUNC_EXT(netadapter)
GETFUNC_EXT(netbuffer)
GETFUNC_EXT(netinterface)
GETFUNC_EXT(pagingspace)
GETFUNC_EXT(process)
GETFUNC_EXT(thread)
GETFUNC_EXT(volumegroup)

struct fsinfo {
        char *devname;
        char *fsname;
	int flags;
	int fstype;
        unsigned long totalblks;
        unsigned long freeblks;
        unsigned long totalinodes;
        unsigned long freeinodes;
};

extern double get_partition_mhz(perfstat_partition_config_t);
extern char *get_ps_hostname(perfstat_pagingspace_t *);
extern char *get_ps_filename(perfstat_pagingspace_t *);
extern char *get_ps_vgname(perfstat_pagingspace_t *);
extern time_t boottime();
struct fsinfo *get_filesystem_stat(struct fsinfo *, int);
int get_mounts(struct vmount **);
void fill_statfs(struct statfs, struct fsinfo *);
int getfsinfo(char *, char *, char *, char *, int, int, struct fsinfo *);
struct fsinfo *get_all_fs(int *);

#endif
