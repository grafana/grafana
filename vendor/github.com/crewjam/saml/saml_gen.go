package saml

//go:generate bash -c "(cat README.md | grep -E -v '^# SAML' | sed 's|^## ||g' | sed 's|\\*\\*||g' | sed 's|^|// |g'; echo 'package saml') > saml.go"
