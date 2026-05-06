package types

import (
	"fmt"
	"net/netip"
	"reflect"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/common/types/traits"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

var ipaddrLibraryDecls = map[string][]cel.FunctionOpt{
	"ipaddress": {
		cel.Overload("string_to_ipaddress", []*cel.Type{cel.StringType}, ipaddrCelType,
			cel.UnaryBinding(stringToIPAddress))},
}

var ipaddrLib = &IPAddress{}

func IPAddressEnvOption() cel.EnvOption {
	return cel.Lib(ipaddrLib)
}

func (ip IPAddress) CompileOptions() []cel.EnvOption {
	options := []cel.EnvOption{}
	for name, overloads := range ipaddrLibraryDecls {
		options = append(options, cel.Function(name, overloads...))
	}
	return options
}

func (ip IPAddress) ProgramOptions() []cel.ProgramOption {
	return []cel.ProgramOption{}
}

// IPAddressType defines a ParameterType that is used to represent IP addresses in CEL expressions.
var IPAddressType = registerCustomParamType(
	openfgav1.ConditionParamTypeRef_TYPE_NAME_IPADDRESS,
	cel.ObjectType("IPAddress"),
	ipaddressTypeConverterFunc,
	cel.Function("in_cidr",
		cel.MemberOverload("ipaddr_in_cidr",
			[]*cel.Type{cel.ObjectType("IPAddress"), cel.StringType},
			cel.BoolType,
			cel.BinaryBinding(ipaddressCELBinaryBinding),
		),
	),
)

// IPAddress represents a network IP address.
type IPAddress struct {
	addr netip.Addr
}

// ParseIPAddress attempts to parse the provided ip string. If the provided string does
// not define a well-formed IP address, then an error is returned.
func ParseIPAddress(ip string) (IPAddress, error) {
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return IPAddress{}, err
	}

	return IPAddress{addr}, nil
}

// ipaddrCelType defines a CEL type for the IPAddress and registers it as a receiver type.
var ipaddrCelType = cel.ObjectType("IPAddress", traits.ReceiverType)

// ConvertToNative implements the CEL ref.Val.ConvertToNative.
//
// See https://pkg.go.dev/github.com/google/cel-go/common/types/ref#Val
func (ip IPAddress) ConvertToNative(typeDesc reflect.Type) (any, error) {
	if reflect.TypeOf(ip).AssignableTo(typeDesc) {
		return ip, nil
	}

	switch typeDesc {
	case reflect.TypeOf(""):
		return ip.addr.String(), nil
	default:
		return nil, fmt.Errorf("failed to convert from type '%s' to native Go type 'IPAddress'", typeDesc)
	}
}

// ConvertToType implements the CEL ref.Val.ConvertToType.
//
// See https://pkg.go.dev/github.com/google/cel-go/common/types/ref#Val
func (ip IPAddress) ConvertToType(typeValue ref.Type) ref.Val {
	switch typeValue {
	case types.StringType:
		return types.String(ip.addr.String())
	case types.TypeType:
		return ipaddrCelType
	default:
		return types.NewErr("failed to convert from CEL type '%s' to '%s'", ipaddrCelType, typeValue)
	}
}

// Equal implements the CEL ref.Val.Equal.
//
// See https://pkg.go.dev/github.com/google/cel-go/common/types/ref#Val
func (ip IPAddress) Equal(other ref.Val) ref.Val {
	otherip, ok := other.(IPAddress)
	if !ok {
		return types.NoSuchOverloadErr()
	}

	return types.Bool(ip.addr.Compare(otherip.addr) == 0)
}

// Type implements the CEL ref.Val.Type.
//
// See https://pkg.go.dev/github.com/google/cel-go/common/types/ref#Val
func (ip IPAddress) Type() ref.Type {
	return ipaddrCelType
}

// Value implements ref.Val.Value.
//
// See https://pkg.go.dev/github.com/google/cel-go/common/types/ref#Val
func (ip IPAddress) Value() any {
	return ip
}

// ipaddressBinaryBinding implements a cel.BinaryBinding that is used as a receiver overload for
// comparing an ipaddress value against a network CIDR defined as a string. If the ipaddress is
// within the CIDR range this binding will return true, otherwise it will return false or an error.
//
// See https://pkg.go.dev/github.com/google/cel-go/cel#BinaryBinding
func ipaddressCELBinaryBinding(lhs, rhs ref.Val) ref.Val {
	cidr, ok := rhs.Value().(string)
	if !ok {
		return types.NewErr("a CIDR string is required for comparison")
	}

	network, err := netip.ParsePrefix(cidr)
	if err != nil {
		return types.NewErr("'%s' is a malformed CIDR string", cidr)
	}

	ipaddr, ok := lhs.(IPAddress)
	if !ok {
		return types.NewErr("an IPAddress parameter value is required for comparison")
	}

	return types.Bool(network.Contains(ipaddr.addr))
}

func stringToIPAddress(arg ref.Val) ref.Val {
	ipStr, ok := arg.Value().(string)
	if !ok {
		return types.MaybeNoSuchOverloadErr(arg)
	}

	ipaddr, err := ParseIPAddress(ipStr)
	if err != nil {
		return types.NewErr("%s", err.Error())
	}

	return ipaddr
}
