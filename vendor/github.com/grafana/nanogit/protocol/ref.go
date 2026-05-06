package protocol

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/nanogit/protocol/hash"
)

// RefName represents a Git reference name, providing structured access to its components.
// Git references are pointers to specific commits in the repository's history.
//
// A reference name can be either:
//   - HEAD: A special reference that points to the current branch or commit
//   - A regular reference: Must start with 'refs/' followed by a category and location
//
// Examples:
//   - HEAD
//   - refs/heads/main
//   - refs/tags/v1.0.0
//   - refs/remotes/origin/feature
//
// For more details about Git references, see:
// https://git-scm.com/book/en/v2/Git-Internals-Git-References
type RefName struct {
	// FullName is the entire, raw refname, including the 'refs/' prefix (unless it is HEAD).
	// Examples:
	//   - "HEAD"
	//   - "refs/heads/main"
	//   - "refs/tags/v1.0.0"
	FullName string

	// Category is the first part of the refname after 'refs/'. E.g. 'heads'. Can be 'HEAD' for HEAD.
	// Does not include a final slash.
	// Examples:
	//   - "heads" for "refs/heads/main"
	//   - "tags" for "refs/tags/v1.0.0"
	//   - "remotes" for "refs/remotes/origin/main"
	Category string

	// Location is the final remainder of the refname, after the category. E.g. 'main', 'feature/test'.
	// 'HEAD' does not mean this is HEAD; use 'FullName' to check for 'HEAD'.
	// Examples:
	//   - "main" for "refs/heads/main"
	//   - "v1.0.0" for "refs/tags/v1.0.0"
	//   - "origin/main" for "refs/remotes/origin/main"
	Location string
}

// HEAD is a special-case refname that always exists and is always valid.
// It refers to the current head of the tree, which is typically the latest commit
// on the currently checked out branch.
var HEAD RefName = RefName{
	FullName: "HEAD",
	Category: "HEAD",
	Location: "HEAD",
}

// ParseRefName parses a Git reference name string into a RefName struct.
// It validates the reference name according to Git's reference format rules.
//
// HEAD is always a valid refname. If given, the constant is returned.
// Otherwise, we require the refname to start with `refs/`, then follow these rules:
//
//   - It can include a slash ('/') for hierarchical (directory) grouping. No slash-separated component can start with a dot ('.').
//   - It must contain one slash. This enforces a need for e.g. 'heads/' or 'tags/', but the actual name there is not necessary to consider.
//   - No consecutive dots can ('..') exist anywhere.
//   - They cannot contain: any byte < 40, DEL (177), space, caret ('^'), colon (':'), question mark ('?'), asterisk ('*'), open square bracket ('[').
//   - It cannot end with a slash or a dot ('/', '.').
//   - It cannot end with '.lock'.
//   - It cannot contain '@{'.
//   - It cannot contain a '\\'.
//
// Examples of valid references:
//   - "HEAD"
//   - "refs/heads/main"
//   - "refs/tags/v1.0.0"
//   - "refs/remotes/origin/feature"
//
// Examples of invalid references:
//   - "refs" (missing category)
//   - "refs/heads" (missing location)
//   - "refs/heads/.." (ends with dot)
//   - "refs/heads/feature..test" (contains consecutive dots)
//   - "refs/heads/feature.lock" (ends with .lock)
//
// See https://git-scm.com/docs/git-check-ref-format for the complete reference format specification.
func ParseRefName(in string) (RefName, error) {
	if in == "HEAD" {
		return HEAD, nil
	}

	rn := RefName{FullName: in}

	refPath, err := validateRefPrefix(in)
	if err != nil {
		return rn, err
	}

	sepIdx, err := validateRefCategory(refPath)
	if err != nil {
		return rn, err
	}

	err = validateRefStructure(refPath)
	if err != nil {
		return rn, err
	}

	err = validateRefComponents(refPath)
	if err != nil {
		return rn, err
	}

	rn.Category = refPath[:sepIdx]
	rn.Location = refPath[sepIdx+1:]

	return rn, nil
}

// validateRefPrefix checks if the ref has the required "refs/" prefix
func validateRefPrefix(in string) (string, error) {
	if !strings.HasPrefix(in, "refs/") {
		return "", errors.New("ref name does not include refs/ prefix")
	}
	return in[len("refs/"):], nil
}

// validateRefCategory checks if the ref has a valid category
func validateRefCategory(refPath string) (int, error) {
	sepIdx := strings.IndexRune(refPath, '/')
	if sepIdx == -1 {
		return 0, errors.New("ref name does not include a category")
	}
	return sepIdx, nil
}

// validateRefStructure validates the overall structure of the ref
func validateRefStructure(refPath string) error {
	if strings.Contains(refPath, "..") {
		return errors.New("ref cannot have two consecutive dots `..` anywhere")
	}

	if strings.Contains(refPath, "//") {
		return errors.New("ref cannot contain multiple consecutive slashes")
	}

	if strings.Contains(refPath, "@{") {
		return errors.New("ref cannot contain a sequence `@{`")
	}

	if strings.HasSuffix(refPath, ".") {
		return errors.New("ref cannot end with a dot `.`")
	}

	return nil
}

// validateRefComponents validates each component of the ref path
func validateRefComponents(refPath string) error {
	for _, component := range strings.Split(refPath, "/") {
		if err := validateSingleComponent(component); err != nil {
			return err
		}
	}
	return nil
}

// validateSingleComponent validates a single ref component
func validateSingleComponent(component string) error {
	if component == "" {
		return errors.New("ref components cannot be empty")
	}

	if strings.HasPrefix(component, ".") {
		return errors.New("ref components cannot begin with a dot `.` or end with the sequence .lock")
	}

	if strings.HasSuffix(component, ".lock") {
		return errors.New("ref components cannot end with the sequence `.lock`")
	}

	hasInvalidRunes := strings.ContainsFunc(component, func(r rune) bool {
		return r < 0o040 || r == 0o177 || r == ' ' || r == '~' || r == '^' || r == ':' || r == '?' || r == '*' || r == '[' || r == '\\'
	})

	if hasInvalidRunes {
		return errors.New("ref components cannot contain control characters, spaces, `~`, `^`, `:`, `?`, `*`, `[`, `DEL`, or a backslash")
	}

	return nil
}

// ZeroHash represents the all-zeros SHA-1 hash used in Git to represent a non-existent object
const ZeroHash = "0000000000000000000000000000000000000000"

type RefUpdateRequest struct {
	OldRef  string
	NewRef  string
	RefName string
}

func NewCreateRefRequest(refName string, newRef hash.Hash) RefUpdateRequest {
	return RefUpdateRequest{
		OldRef:  ZeroHash,
		NewRef:  newRef.String(),
		RefName: refName,
	}
}

func NewUpdateRefRequest(oldRef, newRef hash.Hash, refName string) RefUpdateRequest {
	return RefUpdateRequest{
		OldRef:  oldRef.String(),
		NewRef:  newRef.String(),
		RefName: refName,
	}
}

func NewDeleteRefRequest(oldRef hash.Hash, refName string) RefUpdateRequest {
	return RefUpdateRequest{
		OldRef:  oldRef.String(),
		NewRef:  ZeroHash,
		RefName: refName,
	}
}

// Format formats the ref update request into a byte slice that can be sent over the wire.
// The format follows Git's receive-pack protocol:
//   - A pkt-line containing the ref update command
//   - An empty pack file (required by the protocol)
//   - A flush packet to indicate the end of the request
//
// The ref update command format is:
//
//	<old-value> <new-value> <ref-name>\000<capabilities>\n
//
// The old-value and new-value fields have specific meanings depending on the operation:
//   - Create: old-value is ZeroHash, new-value is the target hash
//   - Update: old-value is the current hash, new-value is the target hash
//   - Delete: old-value is the current hash, new-value is ZeroHash
//
// Returns:
//   - A byte slice containing the formatted request
//   - Any error that occurred during formatting
//
// Examples:
//
//	Create refs/heads/main pointing to 1234...:
//	"0000... 1234... refs/heads/main\000report-status-v2 side-band-64k quiet object-format=sha1 agent=nanogit\n"
//
//	Update refs/heads/main from 1234... to 5678...:
//	"1234... 5678... refs/heads/main\000report-status-v2 side-band-64k quiet object-format=sha1 agent=nanogit\n"
//
//	Delete refs/heads/main:
//	"1234... 0000... refs/heads/main\000report-status-v2 side-band-64k quiet object-format=sha1 agent=nanogit\n"
func (r RefUpdateRequest) Format() ([]byte, error) {
	// Validate hash lengths
	if len(r.OldRef) != 40 && r.OldRef != ZeroHash {
		return nil, fmt.Errorf("invalid old ref hash length: got %d, want 40", len(r.OldRef))
	}
	if len(r.NewRef) != 40 && r.NewRef != ZeroHash {
		return nil, fmt.Errorf("invalid new ref hash length: got %d, want 40", len(r.NewRef))
	}

	// Create the ref using receive-pack
	// Format: <old-value> <new-value> <ref-name>\000<capabilities>\n
	refLine := fmt.Sprintf("%s %s %s\000report-status-v2 side-band-64k quiet object-format=sha1 agent=nanogit\n", r.OldRef, r.NewRef, r.RefName)

	// Calculate the correct length (including the 4 bytes of the length field)
	lineLen := len(refLine) + 4
	pkt := make([]byte, 0, lineLen+4)
	pkt = fmt.Appendf(pkt, "%04x%s0000", lineLen, refLine)

	// Send pack file as raw data (not as a pkt-line)
	// It seems we need to send the empty pack even if it's not needed.
	pkt = append(pkt, EmptyPack...)

	// Add final flush packet
	pkt = append(pkt, FlushPacket...)

	return pkt, nil
}

type RefLine struct {
	RefName string
	Hash    hash.Hash
}

// ParseRefLine parses a single reference line from the git response.
// Returns the reference name, hash, and any error encountered.
func ParseRefLine(line []byte) (RefLine, error) {
	// Skip empty lines and pkt-line flush markers
	if len(line) == 0 || bytes.Equal(line, []byte("0000")) {
		return RefLine{}, nil
	}

	// Skip capability lines (they start with =)
	if len(line) > 0 && line[0] == '=' {
		return RefLine{}, nil
	}

	// Split into hash and rest
	parts := bytes.SplitN(line, []byte(" "), 2)
	if len(parts) != 2 {
		return RefLine{}, fmt.Errorf("invalid ref format: %s", line)
	}

	// Ensure we have a full 40-character SHA-1 hash
	hashStr := string(parts[0])
	if len(hashStr) != 40 {
		return RefLine{}, fmt.Errorf("invalid hash length: got %d, want 40", len(hashStr))
	}

	h, err := hash.FromHex(hashStr)
	if err != nil {
		return RefLine{}, fmt.Errorf("invalid hash: %w", err)
	}

	refName := strings.TrimSpace(string(parts[1]))

	// Handle HEAD reference with capabilities
	if strings.HasPrefix(refName, "HEAD") {
		symref := extractSymref(refName)
		if symref != "" {
			return RefLine{
				RefName: symref,
				Hash:    h,
			}, nil
		}

		return RefLine{
			RefName: refName,
			Hash:    h,
		}, nil
	}

	// Remove capability suffix if present
	if idx := bytes.IndexByte(parts[1], '\x00'); idx > 0 {
		refName = string(parts[1][:idx])
	}

	return RefLine{
		RefName: strings.TrimSpace(refName),
		Hash:    h,
	}, nil
}

// extractSymref extracts the symref value from a line.
// It returns the symref value if present, and an error if it is not present.
// Example:
// 00437fd1a60b01f91b314f59955a4e4d4e80d8edf11d HEAD symref=HEAD:refs/heads/master
// The symref value is "refs/heads/master".
func extractSymref(line string) string {
	// Check for symref in the reference line
	parts := strings.Split(line, " ")
	if len(parts) == 1 {
		return ""
	}

	if idx := strings.Index(line, "symref="); idx > 0 {
		symref := line[idx+7:]
		if colonIdx := strings.Index(symref, ":"); colonIdx > 0 {
			return strings.TrimSpace(symref[colonIdx+1:])
		}

		return strings.TrimSpace(symref)
	}

	return ""
}
