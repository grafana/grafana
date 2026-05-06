package cli

import (
	"fmt"
	"strings"
	"unicode"
)

const (
	providedButNotDefinedErrMsg = "flag provided but not defined: -"
	argumentNotProvidedErrMsg   = "flag needs an argument: "
)

// flagFromError tries to parse a provided flag from an error message. If the
// parsing fails, it returns the input error and an empty string
func flagFromError(err error) (string, error) {
	errStr := err.Error()
	trimmed := strings.TrimPrefix(errStr, providedButNotDefinedErrMsg)
	if errStr == trimmed {
		return "", err
	}
	return trimmed, nil
}

func (cmd *Command) parseFlags(args Args) (Args, error) {
	tracef("parsing flags from arguments %[1]q (cmd=%[2]q)", args, cmd.Name)

	cmd.setFlags = map[Flag]struct{}{}
	cmd.appliedFlags = cmd.allFlags()

	tracef("walking command lineage for persistent flags (cmd=%[1]q)", cmd.Name)

	for pCmd := cmd.parent; pCmd != nil; pCmd = pCmd.parent {
		tracef(
			"checking ancestor command=%[1]q for persistent flags (cmd=%[2]q)",
			pCmd.Name, cmd.Name,
		)

		for _, fl := range pCmd.Flags {
			flNames := fl.Names()

			pfl, ok := fl.(LocalFlag)
			if !ok || pfl.IsLocal() {
				tracef("skipping non-persistent flag %[1]q (cmd=%[2]q)", flNames, cmd.Name)
				continue
			}

			tracef(
				"checking for applying persistent flag=%[1]q pCmd=%[2]q (cmd=%[3]q)",
				flNames, pCmd.Name, cmd.Name,
			)

			applyPersistentFlag := true

			for _, name := range flNames {
				if cmd.lFlag(name) != nil {
					applyPersistentFlag = false
					break
				}
			}

			if !applyPersistentFlag {
				tracef("not applying as persistent flag=%[1]q (cmd=%[2]q)", flNames, cmd.Name)
				continue
			}

			tracef("applying as persistent flag=%[1]q (cmd=%[2]q)", flNames, cmd.Name)

			tracef("appending to applied flags flag=%[1]q (cmd=%[2]q)", flNames, cmd.Name)
			cmd.appliedFlags = append(cmd.appliedFlags, fl)
		}
	}

	tracef("parsing flags iteratively tail=%[1]q (cmd=%[2]q)", args.Tail(), cmd.Name)
	defer tracef("done parsing flags (cmd=%[1]q)", cmd.Name)

	posArgs := []string{}
	for rargs := args.Slice(); len(rargs) > 0; rargs = rargs[1:] {
		tracef("rearrange:1 (cmd=%[1]q) %[2]q", cmd.Name, rargs)

		firstArg := strings.TrimSpace(rargs[0])
		if len(firstArg) == 0 {
			break
		}

		// stop parsing once we see a "--"
		if firstArg == "--" {
			posArgs = append(posArgs, rargs[1:]...)
			return &stringSliceArgs{posArgs}, nil
		}

		// handle positional args
		if firstArg[0] != '-' {
			// positional argument probably
			tracef("rearrange-3 (cmd=%[1]q) check %[2]q", cmd.Name, firstArg)

			// if there is a command by that name let the command handle the
			// rest of the parsing
			if cmd.Command(firstArg) != nil {
				posArgs = append(posArgs, rargs...)
				return &stringSliceArgs{posArgs}, nil
			}

			posArgs = append(posArgs, firstArg)
			continue
		}

		numMinuses := 1
		// this is same as firstArg == "-"
		if len(firstArg) == 1 {
			posArgs = append(posArgs, firstArg)
			break
		}

		shortOptionHandling := cmd.useShortOptionHandling()

		// stop parsing -- as short flags
		if firstArg[1] == '-' {
			numMinuses++
			shortOptionHandling = false
		} else if !unicode.IsLetter(rune(firstArg[1])) {
			// this is not a flag
			tracef("parseFlags not a unicode letter. Stop parsing")
			posArgs = append(posArgs, rargs...)
			return &stringSliceArgs{posArgs}, nil
		}

		tracef("parseFlags (shortOptionHandling=%[1]q)", shortOptionHandling)

		flagName := firstArg[numMinuses:]
		flagVal := ""
		tracef("flagName:1 (fName=%[1]q)", flagName)
		if index := strings.Index(flagName, "="); index != -1 {
			flagVal = flagName[index+1:]
			flagName = flagName[:index]
		}

		tracef("flagName:2 (fName=%[1]q) (fVal=%[2]q)", flagName, flagVal)

		f := cmd.lookupFlag(flagName)
		// found a flag matching given flagName
		if f != nil {
			tracef("Trying flag type (fName=%[1]q) (type=%[2]T)", flagName, f)
			if fb, ok := f.(boolFlag); ok && fb.IsBoolFlag() {
				if flagVal == "" {
					flagVal = "true"
				}
				tracef("parse Apply bool flag (fName=%[1]q) (fVal=%[2]q)", flagName, flagVal)
				if err := cmd.set(flagName, f, flagVal); err != nil {
					return &stringSliceArgs{posArgs}, err
				}
				continue
			}

			tracef("processing non bool flag (fName=%[1]q)", flagName)
			// not a bool flag so need to get the next arg
			if flagVal == "" {
				if len(rargs) == 1 {
					return &stringSliceArgs{posArgs}, fmt.Errorf("%s%s", argumentNotProvidedErrMsg, firstArg)
				}
				flagVal = rargs[1]
				rargs = rargs[1:]
			}

			tracef("setting non bool flag (fName=%[1]q) (fVal=%[2]q)", flagName, flagVal)
			if err := cmd.set(flagName, f, flagVal); err != nil {
				return &stringSliceArgs{posArgs}, err
			}

			continue
		}

		// no flag lookup found and short handling is disabled
		if !shortOptionHandling {
			return &stringSliceArgs{posArgs}, fmt.Errorf("%s%s", providedButNotDefinedErrMsg, flagName)
		}

		// try to split the flags
		for index, c := range flagName {
			tracef("processing flag (fName=%[1]q)", string(c))
			if sf := cmd.lookupFlag(string(c)); sf == nil {
				return &stringSliceArgs{posArgs}, fmt.Errorf("%s%s", providedButNotDefinedErrMsg, flagName)
			} else if fb, ok := sf.(boolFlag); ok && fb.IsBoolFlag() {
				fv := flagVal
				if index == (len(flagName)-1) && flagVal == "" {
					fv = "true"
				}
				if fv == "" {
					fv = "true"
				}
				if err := cmd.set(flagName, sf, fv); err != nil {
					tracef("processing flag.2 (fName=%[1]q)", string(c))
					return &stringSliceArgs{posArgs}, err
				}
			} else if index == len(flagName)-1 { // last flag can take an arg
				if flagVal == "" {
					if len(rargs) == 1 {
						return &stringSliceArgs{posArgs}, fmt.Errorf("%s%s", argumentNotProvidedErrMsg, string(c))
					}
					flagVal = rargs[1]
				}
				tracef("parseFlags (flagName %[1]q) (flagVal %[2]q)", flagName, flagVal)
				if err := cmd.set(flagName, sf, flagVal); err != nil {
					tracef("processing flag.4 (fName=%[1]q)", string(c))
					return &stringSliceArgs{posArgs}, err
				}
			}
		}
	}

	tracef("returning-2 (cmd=%[1]q) args %[2]q", cmd.Name, posArgs)
	return &stringSliceArgs{posArgs}, nil
}
