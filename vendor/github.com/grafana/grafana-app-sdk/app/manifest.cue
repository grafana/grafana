package app

config: {
	codegen: {
		goGenPath: "app"
	}
	definitions: {
		path: "app/definitions"
	}
	kinds: {
		grouping: "group"
	}
}

manifest: {
	appName: "app-manifest"
	groupOverride: "apps.grafana.com"
	versions: {
		"v1alpha1": {
			codegen: ts: enabled: false
			kinds: [appManifestv1alpha1]
		}
		"v1alpha2": {
			codegen: ts: enabled: false
			kinds: [appManifestv1alpha2]
		}
	}
	extraPermissions: {
		accessKinds: [{
			group: "apiextensions.k8s.io",
			resource: "customresourcedefinitions",
			actions: ["get","list","create","update","delete","watch"],
		}]
	}
}

appManifestKind: {
	kind: "AppManifest"
	scope: "Cluster"
	codegen: {
		ts: enabled: false
	}
}
