#include "c_helpers.h"

GETFUNC(cpu)
GETFUNC(disk)
GETFUNC(diskadapter)
GETFUNC(diskpath)
GETFUNC(fcstat)
GETFUNC(logicalvolume)
GETFUNC(memory_page)
GETFUNC(netadapter)
GETFUNC(netbuffer)
GETFUNC(netinterface)
GETFUNC(pagingspace)
GETFUNC(process)
GETFUNC(thread)
GETFUNC(volumegroup)

double get_partition_mhz(perfstat_partition_config_t pinfo) {
	return pinfo.processorMHz;
}

char *get_ps_hostname(perfstat_pagingspace_t *ps) {
	return ps->u.nfs_paging.hostname;
}

char *get_ps_filename(perfstat_pagingspace_t *ps) {
	return ps->u.nfs_paging.filename;
}

char *get_ps_vgname(perfstat_pagingspace_t *ps) {
	return ps->u.lv_paging.vgname;
}

time_t boottime()
{
        register struct utmpx *utmp;

	setutxent();
        while ( (utmp = getutxent()) != NULL ) {
                if (utmp->ut_type == BOOT_TIME) {
                        return utmp->ut_tv.tv_sec;
                }
        }
	endutxent();
        return -1;
}

struct fsinfo *get_filesystem_stat(struct fsinfo *fs_all, int n) {
	if (!fs_all) return NULL;
	return &(fs_all[n]);
}

int get_mounts(struct vmount **vmountpp) {
        int size;
        struct vmount *vm;
        int nmounts;

        size = BUFSIZ;

        while (1) {
                if ((vm = (struct vmount *)malloc((size_t)size)) == NULL) {
                        perror("malloc failed");
                        exit(-1);
                }
                if ((nmounts = mntctl(MCTL_QUERY, size, (caddr_t)vm)) > 0) {
                        *vmountpp = vm;
                        return nmounts;
                } else if (nmounts == 0) {
                        size = *(int *)vm;
                        free((void *)vm);
                } else {
                        free((void *)vm);
                        return -1;
                }
        }
}

void fill_fsinfo(struct statfs statbuf, struct fsinfo *fs) {
        fsblkcnt_t freeblks, totblks, usedblks;
        fsblkcnt_t tinodes, ninodes, ifree;
        uint    cfactor;

        if (statbuf.f_blocks == -1) {
                fs->totalblks = 0;
                fs->freeblks = 0;
                fs->totalinodes = 0;
                fs->freeinodes = 0;
                return;
        }

        cfactor = statbuf.f_bsize / 512;
        fs->freeblks = statbuf.f_bavail * cfactor;
        fs->totalblks = statbuf.f_blocks * cfactor;

        fs->freeinodes = statbuf.f_ffree;
        fs->totalinodes = statbuf.f_files;

        if (fs->freeblks < 0)
                fs->freeblks = 0;
}

int getfsinfo(char *fsname, char *devname, char *host, char *options, int flags, int fstype, struct fsinfo *fs) {
        struct statfs statbuf;
	int devname_size = strlen(devname);
	int fsname_size = strlen(fsname);
        char buf[BUFSIZ];
        char *p;

        if (fs == NULL) {
                return 1;
        }

        for (p = strtok(options, ","); p != NULL; p = strtok(NULL, ","))
                if (strcmp(p, "ignore") == 0)
                        return 0;

        if (*host != 0 && strcmp(host, "-") != 0) {
                sprintf(buf, "%s:%s", host, devname);
                devname = buf;
        }
        fs->devname = (char *)calloc(devname_size+1, 1);
        fs->fsname = (char *)calloc(fsname_size+1, 1);
        strncpy(fs->devname, devname, devname_size);
        strncpy(fs->fsname, fsname, fsname_size);
	fs->flags = flags;
	fs->fstype = fstype;

        if (statfs(fsname,&statbuf) < 0) {
                return 1;
        }

        fill_fsinfo(statbuf, fs);
        return 0;
}

struct fsinfo *get_all_fs(int *rc) {
        struct vmount *mnt;
        struct fsinfo *fs_all;
        int nmounts;

        *rc = -1;
        if ((nmounts = get_mounts(&mnt)) <= 0) {
                perror("Can't get mount table info");
                return NULL;
        }

        fs_all = (struct fsinfo *)calloc(sizeof(struct fsinfo), nmounts);
        while ((*rc)++, nmounts--) {
                getfsinfo(vmt2dataptr(mnt, VMT_STUB),
                          vmt2dataptr(mnt, VMT_OBJECT),
                          vmt2dataptr(mnt, VMT_HOST),
                          vmt2dataptr(mnt, VMT_ARGS),
			  mnt->vmt_flags,
			  mnt->vmt_gfstype,
                          &fs_all[*rc]);
                mnt = (struct vmount *)((char *)mnt + mnt->vmt_length);
        }
        return fs_all;
}
