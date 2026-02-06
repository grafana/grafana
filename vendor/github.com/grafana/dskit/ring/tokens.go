package ring

import (
	"encoding/json"
	"errors"
	"os"
	"sort"
)

type Token uint32

// Tokens is a simple list of tokens.
type Tokens []uint32

func (t Tokens) Len() int           { return len(t) }
func (t Tokens) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t Tokens) Less(i, j int) bool { return t[i] < t[j] }

// Equals returns whether the tokens are equal to the input ones.
func (t Tokens) Equals(other Tokens) bool {
	if len(t) != len(other) {
		return false
	}

	mine := t
	sort.Sort(mine)
	sort.Sort(other)

	for i := 0; i < len(mine); i++ {
		if mine[i] != other[i] {
			return false
		}
	}

	return true
}

// StoreToFile stores the tokens in the given directory.
func (t Tokens) StoreToFile(tokenFilePath string) error {
	if tokenFilePath == "" {
		return errors.New("path is empty")
	}

	// If any operations failed further in the function, we keep the temporary
	// file hanging around for debugging.
	f, err := os.Create(tokenFilePath + ".tmp")
	if err != nil {
		return err
	}

	defer func() {
		// If the file was not closed, then there must already be an error, hence ignore
		// the error (if any) from f.Close(). If the file was already closed, then
		// we would ignore the error in that case too.
		_ = f.Close()
	}()

	b, err := t.Marshal()
	if err != nil {
		return err
	}
	if _, err = f.Write(b); err != nil {
		return err
	}

	if err := f.Close(); err != nil {
		return err
	}

	// Tokens successfully written, replace the temporary file with the actual file path.
	return os.Rename(f.Name(), tokenFilePath)
}

// LoadTokensFromFile loads tokens from given file path.
func LoadTokensFromFile(tokenFilePath string) (Tokens, error) {
	b, err := os.ReadFile(tokenFilePath)
	if err != nil {
		return nil, err
	}
	var t Tokens
	err = t.Unmarshal(b)

	// Tokens may have been written to file by an older version which
	// doesn't guarantee sorted tokens, so we enforce sorting here.
	if !sort.IsSorted(t) {
		sort.Sort(t)
	}

	return t, err
}

// Marshal encodes the tokens into JSON.
func (t Tokens) Marshal() ([]byte, error) {
	return json.Marshal(tokensJSON{Tokens: t})
}

// Unmarshal reads the tokens from JSON byte stream.
func (t *Tokens) Unmarshal(b []byte) error {
	tj := tokensJSON{}
	if err := json.Unmarshal(b, &tj); err != nil {
		return err
	}
	*t = tj.Tokens
	return nil
}

type tokensJSON struct {
	Tokens []uint32 `json:"tokens"`
}
