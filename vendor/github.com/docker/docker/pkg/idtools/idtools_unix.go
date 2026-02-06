//go:build !windows

package idtools

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"syscall"

	"github.com/moby/sys/user"
)

func mkdirAs(path string, mode os.FileMode, owner Identity, mkAll, chownExisting bool) error {
	path, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	stat, err := os.Stat(path)
	if err == nil {
		if !stat.IsDir() {
			return &os.PathError{Op: "mkdir", Path: path, Err: syscall.ENOTDIR}
		}
		if !chownExisting {
			return nil
		}

		// short-circuit -- we were called with an existing directory and chown was requested
		return setPermissions(path, mode, owner, stat)
	}

	// make an array containing the original path asked for, plus (for mkAll == true)
	// all path components leading up to the complete path that don't exist before we MkdirAll
	// so that we can chown all of them properly at the end.  If chownExisting is false, we won't
	// chown the full directory path if it exists
	var paths []string
	if os.IsNotExist(err) {
		paths = []string{path}
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
			if _, err = os.Stat(dirPath); err != nil && os.IsNotExist(err) {
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
		if err = setPermissions(pathComponent, mode, owner, nil); err != nil {
			return err
		}
	}
	return nil
}

// LookupUser uses traditional local system files lookup (from libcontainer/user) on a username
//
// Deprecated: use [user.LookupUser] instead
func LookupUser(name string) (user.User, error) {
	return user.LookupUser(name)
}

// LookupUID uses traditional local system files lookup (from libcontainer/user) on a uid
//
// Deprecated: use [user.LookupUid] instead
func LookupUID(uid int) (user.User, error) {
	return user.LookupUid(uid)
}

// LookupGroup uses traditional local system files lookup (from libcontainer/user) on a group name,
//
// Deprecated: use [user.LookupGroup] instead
func LookupGroup(name string) (user.Group, error) {
	return user.LookupGroup(name)
}

// setPermissions performs a chown/chmod only if the uid/gid don't match what's requested
// Normally a Chown is a no-op if uid/gid match, but in some cases this can still cause an error, e.g. if the
// dir is on an NFS share, so don't call chown unless we absolutely must.
// Likewise for setting permissions.
func setPermissions(p string, mode os.FileMode, owner Identity, stat os.FileInfo) error {
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
	if ssi.Uid == uint32(owner.UID) && ssi.Gid == uint32(owner.GID) {
		return nil
	}
	return os.Chown(p, owner.UID, owner.GID)
}

// LoadIdentityMapping takes a requested username and
// using the data from /etc/sub{uid,gid} ranges, creates the
// proper uid and gid remapping ranges for that user/group pair
func LoadIdentityMapping(name string) (IdentityMapping, error) {
	// TODO: Consider adding support for calling out to "getent"
	usr, err := user.LookupUser(name)
	if err != nil {
		return IdentityMapping{}, fmt.Errorf("could not get user for username %s: %v", name, err)
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

func lookupSubRangesFile(path string, usr user.User) ([]IDMap, error) {
	uidstr := strconv.Itoa(usr.Uid)
	rangeList, err := user.ParseSubIDFileFilter(path, func(sid user.SubID) bool {
		return sid.Name == usr.Name || sid.Name == uidstr
	})
	if err != nil {
		return nil, err
	}
	if len(rangeList) == 0 {
		return nil, fmt.Errorf("no subuid ranges found for user %q", usr.Name)
	}

	idMap := []IDMap{}

	containerID := 0
	for _, idrange := range rangeList {
		idMap = append(idMap, IDMap{
			ContainerID: containerID,
			HostID:      int(idrange.SubID),
			Size:        int(idrange.Count),
		})
		containerID = containerID + int(idrange.Count)
	}
	return idMap, nil
}
