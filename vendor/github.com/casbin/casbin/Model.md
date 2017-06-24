# Access control models in Casbin

## Table of Contents

- [Request definition](#request-definition)
- [Policy definition](#policy-definition)
- [Policy effect](#policy-effect)
- [Matchers](#matchers)
  * [Functions in matchers](#functions-in-matchers)
  * [How to add a customized function](#how-to-add-a-customized-function)
- [Role definition (optional)](#role-definition--optional-)
- [Role definition with domains/tenants (optional)](#role-definition-with-domains-tenants--optional-)

A model CONF should have at least four sections: ``[request_definition], [policy_definition], [policy_effect], [matchers]``. If the model uses RBAC, it should also add ``[role_definition]``. The comments start with ``#``.

## Request definition

``[request_definition]`` is the definition for the access request. It defines the arguments in ``e.Enforce(...)`` function.

```ini
[request_definition]
r = sub, obj, act
```

``sub, obj, act`` represents the classic triple: accessing entity (Subject), accessed resource (Object) and the access method (Action). However, you can customize your own request form, like ``sub, act`` if you don't need to specify an particular resource, or ``sub, sub2, obj, act`` if you somehow have two accessing entities.

## Policy definition

``[policy_definition]`` is the definition for the policy. It defines the meaning of the policy. For example, we have the following model:

```ini
[policy_definition]
p = sub, obj, act
p2 = sub, act
```

And we have the following policy (if in a policy file)

```
p, alice, data1, read
p2, bob, write-all-objects
```

Each line in a policy is called a policy rule. Each policy rule starts with a ``policy type``, e.g., `p`, `p2`. It is used to match the policy definition if there are multiple definitions. The above policy shows this binding:

```
(alice, data1, read) -> (p.sub, p.obj, p.act)
(bob, write-all-objects) -> (p2.sub, p2.act)
```

The binding can be used in the matchers. For common cases, the user doesn't have multiple policy definitions, so probably you will only use policy type ``p``.

## Policy effect

``[policy_effect]`` is the definition for the policy effect. It defines whether the access request should be approved if multiple policy rules match the request. For example, one rule permits and the other denies.

```ini
[policy_effect]
e = some(where (p.eft == allow))
```

The above policy effect means if there's any matched policy rule of ``allow``, the final effect is ``allow`` (aka allow-override). ``p.eft`` is the effect for a policy, it can be ``allow`` or ``deny``. It's optional and the default value is ``allow``. So as we didn't specify it above, it uses the default value.

Another example for policy effect is:

```ini
[policy_effect]
e = !some(where (p.eft == deny))
```

It means if there should be no matched policy rules of``deny`` (aka deny-override). ``some`` means: if there exists one matched policy rule. ``any`` means: all matched policy rules (not used here). The policy effect can even be connected with logic expressions:

```ini
[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))
```

It means at least one matched policy rule of``allow``, and there is no matched policy rule of``deny``. So in this way, both the allow and deny authorizations are supported, and the deny overrides.

## Matchers

``[matchers]`` is the definition for policy matchers. The matchers are expressions. It defines how the policy rules are evaluated against the request.

```ini
[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
```

The above matcher is the simplest, it means that the subject, object and action in a request should match the ones in a policy rule.

You can use arithmetic like ``+, -, *, /`` and logical operators like ``&&, ||, !`` in matchers.

### Functions in matchers

You can even specify functions in a matcher. You can use the built-in functions or specify your own function. The supported built-in functions are:

- ``keyMatch(arg1, arg2)``: arg1 and arg2 are usually paths or URLs. arg2 can have pattern (*). It returns whether arg1 matches arg2.
- ``regexMatch(arg1, arg2)``: arg1 can be any string. arg2 is a regular expression. It returns whether arg1 matches arg2.

Please refer to [keymatch_model.conf](https://github.com/casbin/casbin/blob/master/examples/keymatch_model.conf) for examples.

### How to add a customized function

First prepare your function. It takes several parameters and return a bool:

```go
func KeyMatch(key1 string, key2 string) bool {
	i := strings.Index(key2, "*")
	if i == -1 {
		return key1 == key2
	}

	if len(key1) > i {
		return key1[:i] == key2[:i]
	}
	return key1 == key2[:i]
}
```

Then wrap it with ``interface{}`` types:

```go
func KeyMatchFunc(args ...interface{}) (interface{}, error) {
	name1 := args[0].(string)
	name2 := args[1].(string)

	return (bool)(KeyMatch(name1, name2)), nil
}
```

At last, register the function to the Casbin enforcer:

```go
e.AddFunction("my_func", KeyMatchFunc)
```

Now, you can use the function in your model CONF like this:

```ini
[matchers]
m = r.sub == p.sub && my_func(r.obj, p.obj) && r.act == p.act
```

## Role definition (optional)

``[role_definition]`` is the definition for the RBAC role inheritance relations. Casbin supports multiple instances of RBAC systems, e.g., users can have roles and their inheritance relations, and resources can have roles and their inheritance relations too. These two RBAC systems won't interfere.

This section is optional. If you don't use RBAC roles in the model, then omit this section.

```ini
[role_definition]
g = _, _
g2 = _, _
```

The above role definition shows that ``g`` is a RBAC system, and ``g2`` is another RBAC system. ``_, _`` means there are two parties inside an inheritance relation. As a common case, you usually use ``g`` alone if you only need roles on users. and you can use ``g`` and ``g2`` when you need roles (or groups) on both users and resources. Please see the [rbac_model.conf](https://github.com/casbin/casbin/blob/master/examples/rbac_model.conf) and [rbac_model_with_resource_roles.conf](https://github.com/casbin/casbin/blob/master/examples/rbac_model_with_resource_roles.conf) for examples.

Casbin stores the actual user-role mapping (or resource-role mapping if you are using roles on resources) in the policy, for example:

```
p, data2_admin, data2, read
g, alice, data2_admin
```

It means ``alice`` inherits/is a member of role ``data2_admin``. ``alice`` here can be a user, a resource or a role. Casbin only recognizes it as a string.

Then in a matcher, you should check the role as below:

```ini
[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

It means ``sub`` in the request should has the role ``sub`` in the policy.

There are several things to note:

1. Casbin only stores the user-role mapping.
2. Casbin doesn't verify whether a user is a valid user, or role is a valid role. That should be taken care of by authentication.
3. Do not use the same name for a user and a role inside a RBAC system, because Casbin recognizes users and roles as strings, and there's no way for Casbin to know whether you are specifying user ``alice`` or role ``alice``. You can simply solve it by using ``role_alice``.
4. If ``A`` has role ``B``, ``B`` has role ``C``, then ``A`` has role ``C``. This transitivity is infinite for now.

## Role definition with domains/tenants (optional)

The RBAC roles in Casbin can be global or domain-specific. Domain-specify roles mean that the roles for a user can be different when the user is at different domains/tenants. This is very useful for large systems like a cloud, as the users are usually in different tenants.

The role definition with domains/tenants should be something like:

```ini
[role_definition]
g = _, _, _
```

The 3rd ``_`` means the name of domain/tenant, this part should not be changed. Then the policy can be:

```
p, admin, tenant1, data1, read
p, admin, tenant2, data2, read

g, alice, admin, tenant1
g, alice, user, tenant2
```

It means ``admin`` role in ``tenant1`` can read ``data1``. And ``alice`` has ``admin`` role in ``tenant1``, and has ``user`` role in ``tenant2``. So she can read ``data1``. However, since ``alice`` is not an ``admin`` in ``tenant2``, she cannot read ``data2``.

Then in a matcher, you should check the role as below:

```ini
[matchers]
m = g(r.sub, p.sub, r.dom) && r.dom == p.dom && r.obj == p.obj && r.act == p.act
```

Please see the [rbac_model_with_domains.conf](https://github.com/casbin/casbin/blob/master/examples/rbac_model_with_domains.conf) for examples.
