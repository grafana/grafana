/*
Package xml holds the XMl encoder utility. This utility is written in accordance to our design to delegate to
shape serializer function in which a xml.Value will be passed around.

Resources followed: https://smithy.io/2.0/spec/protocol-traits.html#xml-bindings

Member Element

Member element should be used to encode xml shapes into xml elements except for flattened xml shapes. Member element
write their own element start tag. These elements should always be closed.

Flattened Element

Flattened element should be used to encode shapes marked with flattened trait into xml elements. Flattened element
do not write a start tag, and thus should not be closed.

Simple types encoding

All simple type methods on value such as String(), Long() etc; auto close the associated member element.

Array

Array returns the collection encoder. It has two modes, wrapped and flattened encoding.

Wrapped arrays have two methods Array() and ArrayWithCustomName() which facilitate array member wrapping.
By default, a wrapped array members are wrapped with `member` named start element.

	<wrappedArray><member>apple</member><member>tree</member></wrappedArray>

Flattened arrays rely on Value being marked as flattened.
If a shape is marked as flattened, Array() will use the shape element name as wrapper for array elements.

	<flattenedAarray>apple</flattenedArray><flattenedArray>tree</flattenedArray>

Map

Map is the map encoder. It has two modes, wrapped and flattened encoding.

Wrapped map has Array() method, which facilitate map member wrapping.
By default, a wrapped map members are wrapped with `entry` named start element.

	<wrappedMap><entry><Key>apple</Key><Value>tree</Value></entry><entry><Key>snow</Key><Value>ice</Value></entry></wrappedMap>

Flattened map rely on Value being marked as flattened.
If a shape is marked as flattened, Map() will use the shape element name as wrapper for map entry elements.

	<flattenedMap><Key>apple</Key><Value>tree</Value></flattenedMap><flattenedMap><Key>snow</Key><Value>ice</Value></flattenedMap>
*/
package xml
