// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package procedures

import ast "github.com/dolthub/vitess/go/vt/sqlparser"

// OpCode is the internal representation queries run by Stored Procedures.
type OpCode uint16

const (
	OpCode_Select OpCode = iota
	OpCode_Declare
	OpCode_Signal
	OpCode_Open
	OpCode_Fetch
	OpCode_Close
	OpCode_Set
	OpCode_Call
	OpCode_If
	OpCode_Goto
	OpCode_Execute
	OpCode_Exception
	OpCode_Return
	OpCode_ScopeBegin
	OpCode_ScopeEnd
)

// InterpreterOperation is an operation that will be performed by the interpreter.
type InterpreterOperation struct {
	PrimaryData   ast.Statement // This will represent the "main" data, such as the query for PERFORM, expression for IF, etc.
	Error         error         // This is the error that should be returned for OpCode_Exception
	Target        string        // This is the variable that will store the results (if applicable)
	SecondaryData []string      // This represents auxiliary data, such as bindings, strictness, etc.
	Index         int           // This is the index that should be set for operations that move the function counter
	OpCode        OpCode
}
