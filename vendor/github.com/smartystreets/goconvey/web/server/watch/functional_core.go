package watch

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/smartystreets/goconvey/web/server/messaging"
)

///////////////////////////////////////////////////////////////////////////////

func Categorize(items chan *FileSystemItem, root string, watchSuffixes []string) (folders, profiles, goFiles []*FileSystemItem) {
	for item := range items {
		if item.IsFolder && !isHidden(item.Name) && !foundInHiddenDirectory(item, root) {
			folders = append(folders, item)

		} else if strings.HasSuffix(item.Name, ".goconvey") && len(item.Name) > len(".goconvey") {
			profiles = append(profiles, item)

		} else {
			for _, suffix := range watchSuffixes {
				if strings.HasSuffix(item.Name, suffix) && !isHidden(item.Name) && !foundInHiddenDirectory(item, root) {
					goFiles = append(goFiles, item)
				}
			}
		}
	}
	return folders, profiles, goFiles
}

func foundInHiddenDirectory(item *FileSystemItem, root string) bool {
	path := item.Path
	if len(path) > len(root) {
		path = path[len(root):]
	}

	for _, folder := range strings.Split(filepath.Dir(path), slash) {
		if isHidden(folder) {
			return true
		}
	}

	return false
}
func isHidden(path string) bool {
	return strings.HasPrefix(path, ".") || strings.HasPrefix(path, "_") || strings.HasPrefix(path, "flymake_")
}

///////////////////////////////////////////////////////////////////////////////

func ParseProfile(profile string) (isDisabled bool, tags, arguments []string) {
	lines := strings.Split(profile, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if len(arguments) == 0 && strings.ToLower(line) == "ignore" {
			return true, nil, nil

		} else if strings.HasPrefix(line, "-tags=") {
			tags = append(tags, strings.Split(strings.SplitN(line, "=", 2)[1], ",")...)
			continue

		} else if len(line) == 0 {
			continue

		} else if strings.HasPrefix(line, "#") {
			continue

		} else if strings.HasPrefix(line, "//") {
			continue

		} else if line == "-cover" || strings.HasPrefix(line, "-coverprofile") {
			continue

		} else if line == "-v" {
			continue // Verbose mode is always enabled so there is no need to record it here.

		}

		arguments = append(arguments, line)
	}

	return false, tags, arguments
}

///////////////////////////////////////////////////////////////////////////////

func CreateFolders(items []*FileSystemItem) messaging.Folders {
	folders := map[string]*messaging.Folder{}

	for _, item := range items {
		folders[item.Path] = &messaging.Folder{Path: item.Path, Root: item.Root}
	}

	return folders
}

///////////////////////////////////////////////////////////////////////////////

func LimitDepth(folders messaging.Folders, depth int) {
	if depth < 0 {
		return
	}

	for path, folder := range folders {
		if strings.Count(path[len(folder.Root):], slash) > depth {
			delete(folders, path)
		}
	}
}

///////////////////////////////////////////////////////////////////////////////

func AttachProfiles(folders messaging.Folders, items []*FileSystemItem) {
	for _, profile := range items {
		if folder, exists := folders[filepath.Dir(profile.Path)]; exists {
			folder.Disabled, folder.BuildTags, folder.TestArguments = profile.ProfileDisabled, profile.ProfileTags, profile.ProfileArguments
		}
	}
}

///////////////////////////////////////////////////////////////////////////////

func MarkIgnored(folders messaging.Folders, ignored map[string]struct{}) {
	if len(ignored) == 0 {
		return
	}

	for _, folder := range folders {
		for ignored := range ignored {
			if !folder.Ignored && strings.HasSuffix(folder.Path, ignored) {
				folder.Ignored = true
			}
		}
	}
}

///////////////////////////////////////////////////////////////////////////////

func ActiveFolders(folders messaging.Folders) messaging.Folders {
	var active messaging.Folders = map[string]*messaging.Folder{}

	for path, folder := range folders {
		if folder.Ignored || folder.Disabled {
			continue
		}

		active[path] = folder
	}
	return active
}

///////////////////////////////////////////////////////////////////////////////

func Sum(folders messaging.Folders, items []*FileSystemItem) int64 {
	var sum int64
	for _, item := range items {
		if _, exists := folders[filepath.Dir(item.Path)]; exists {
			sum += item.Size + item.Modified
		}
	}
	return sum
}

///////////////////////////////////////////////////////////////////////////////

const slash = string(os.PathSeparator)

///////////////////////////////////////////////////////////////////////////////
