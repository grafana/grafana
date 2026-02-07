//go:build !windows

package user

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
)

func mkdirAs(path string, mode os.FileMode, uid, gid int, mkAll, onlyNew bool) error {
	path, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	stat, err := os.Stat(path)
	if err == nil {
		if !stat.IsDir() {
			return &os.PathError{Op: "mkdir", Path: path, Err: syscall.ENOTDIR}
		}
		if onlyNew {
			return nil
		}

		// short-circuit -- we were called with an existing directory and chown was requested
		return setPermissions(path, mode, uid, gid, stat)
	}

	// make an array containing the original path asked for, plus (for mkAll == true)
	// all path components leading up to the complete path that don't exist before we MkdirAll
	// so that we can chown all of them properly at the end.  If onlyNew is true, we won't
	// chown the full directory path if it exists
	var paths []string
	if os.IsNotExist(err) {
		paths = append(paths, path)
	}

	if mkAll {
		// walk back to "/" looking for directories which do not exist
		// and add them to the paths array for chown after creation
		dirPath := path
		for {
			dirPath = filepath.Dir(dirPath)
			if dirPath == "/" {
				break
			}
			if _, err = os.Stat(dirPath); os.IsNotExist(err) {
				paths = append(paths, dirPath)
			}
		}
		if err = os.MkdirAll(path, mode); err != nil {
			return err
		}
	} else if err = os.Mkdir(path, mode); err != nil {
		return err
	}
	// even if it existed, we will chown the requested path + any subpaths that
	// didn't exist when we called MkdirAll
	for _, pathComponent := range paths {
		if err = setPermissions(pathComponent, mode, uid, gid, nil); err != nil {
			return err
		}
	}
	return nil
}

// setPermissions performs a chown/chmod only if the uid/gid don't match what's requested
// Normally a Chown is a no-op if uid/gid match, but in some cases this can still cause an error, e.g. if the
// dir is on an NFS share, so don't call chown unless we absolutely must.
// Likewise for setting permissions.
func setPermissions(p string, mode os.FileMode, uid, gid int, stat os.FileInfo) error {
	if stat == nil {
		var err error
		stat, err = os.Stat(p)
		if err != nil {
			return err
		}
	}
	if stat.Mode().Perm() != mode.Perm() {
		if err := os.Chmod(p, mode.Perm()); err != nil {
			return err
		}
	}
	ssi := stat.Sys().(*syscall.Stat_t)
	if ssi.Uid == uint32(uid) && ssi.Gid == uint32(gid) {
		return nil
	}
	return os.Chown(p, uid, gid)
}

// LoadIdentityMapping takes a requested username and
// using the data from /etc/sub{uid,gid} ranges, creates the
// proper uid and gid remapping ranges for that user/group pair
func LoadIdentityMapping(name string) (IdentityMapping, error) {
	// TODO: Consider adding support for calling out to "getent"
	usr, err := LookupUser(name)
	if err != nil {
		return IdentityMapping{}, fmt.Errorf("could not get user for username %s: %w", name, err)
	}

	subuidRanges, err := lookupSubRangesFile("/etc/subuid", usr)
	if err != nil {
		return IdentityMapping{}, err
	}
	subgidRanges, err := lookupSubRangesFile("/etc/subgid", usr)
	if err != nil {
		return IdentityMapping{}, err
	}

	return IdentityMapping{
		UIDMaps: subuidRanges,
		GIDMaps: subgidRanges,
	}, nil
}

func lookupSubRangesFile(path string, usr User) ([]IDMap, error) {
	uidstr := strconv.Itoa(usr.Uid)
	rangeList, err := ParseSubIDFileFilter(path, func(sid SubID) bool {
		return sid.Name == usr.Name || sid.Name == uidstr
	})
	if err != nil {
		return nil, err
	}
	if len(rangeList) == 0 {
		return nil, fmt.Errorf("no subuid ranges found for user %q", usr.Name)
	}

	idMap := []IDMap{}

	var containerID int64
	for _, idrange := range rangeList {
		idMap = append(idMap, IDMap{
			ID:       containerID,
			ParentID: idrange.SubID,
			Count:    idrange.Count,
		})
		containerID = containerID + idrange.Count
	}
	return idMap, nil
}
