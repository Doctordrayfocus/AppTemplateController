# AppTemplateController
The purpose of this custom controller is to generate kubernetes configurations from a main configuration template using the provided `microservice-specific configuration` and apply these generated configurations to the kubernetes cluster.

The `microservice-specific configuration` are provided by a kubernetes custom resources.

## How to use

This controlller is dependent on a custom resource that defines some `microservice-specific configuration`.

### Create a custom resource
Custom resources are used to store `microservices-specific configurations` that would be used by the custom controller. 
Here is an example of a custom resource,

```yml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  # name must match the spec fields below, and be in the form: <plural>.<group>
  name: apptemplates.myapp.domain.com
spec:
  # group name to use for REST API: /apis/<group>/<version>
  group: myapp.domain.com
  # list of versions supported by this CustomResourceDefinition
  versions:
    - name: v1
      # Each version can be enabled/disabled by the Served flag.
      served: true
      # One and only one version must be marked as the storage version.
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                serviceName:
                  type: string
                environment:
                  type: string
                deploymentReplicas:
                  type: integer
                  maximum: 5
                  default: 1
                imageName:
                  type: string
                imageVersion:
                  type: string
                configsToUse:
                  type: string
  # either Namespaced or Cluster
  scope: Namespaced
  names:
    # plural name to be used in the URL: /apis/<group>/<version>/<plural>
    plural: apptemplates
    # singular name to be used as an alias on the CLI and also for displaying
    singular: apptemplate
    # kind is normally the CamelCased singular type. Your resource manifests use this.
    kind: AppTemplate
    # shortNames allow shorter string to match your resource on the CLI
    shortNames:
    - apptemp
```

You can use the custom resource like this,

```yml
apiVersion: "myapp.domain.com/v1"
kind: AppTemplate
metadata:
  name: sample-service
spec:
  serviceName: sample-service
  environment: development
  deploymentReplicas: 2
  imageName: "sample-service_node_app"
  imageVersion: "0.1"
  configsToUse: "redis,cluster-issuer/issuer-1"
```

You can use any `spec` in your custom resource, but the controller requires the `serviceName` and `configsToUse` specifications to function correctly.

`serviceName` - This holds the unique name of the microservice. The controller uses it to detect microservice specific configurations in the main configuration template. 

`configsToUse` - This holds a comma-seperated string of folder paths in the main configuration template. By default, the controller ignores all configurations in all folders,and only apply those in folders whose paths are defined in the `configsToUse`. 

> Note: If you want a set of configurations in the main configuration template to be detected by only a specific microservice, place the configurations in a special folder - `extra-{serviceName}`.

### Deploy the controller
1. Create a new serive account for the controller
```yml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-template
```
2. Add a `ClusterRoleBinding` to assign some roles and permissions to the service account. Assign the  `cluster-admin` role to give the controller full cluster access
```yml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: app-template-role-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: app-template
  namespace: default
```
3. Define the controller configurations using a `configmap`
```yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-template-config
data:
  # your custom resource groupname
  RESOURCE_GROUP: "myapp.domain.com"

  # your custom resource name (plural)
  RESOURCE_NAME: "apptemplates"

  # default api version of your custom resource
  API_VERSION: "v1"

  # default docker container registry
  DOCKER_REGISTRY: "drayfocus"

  # default custom resource namespace
  RESOURCE_NAMESPACE: "default"

  # git repo url for template config files
  CONFIG_REPO_URL: "https://github.com/Doctordrayfocus/AppTemplateConfigs.git"

  # repo sync interval (in seconds)
  SYNC_INTERVAL: "3"
```
- `RESOURCE_GROUP` - This is the group name of the custom resource that defines your microservice-specific configuration
- `RESOURCE_NAME` - This is the plural name of the custom resource that defines your microservice-specific configuration
- `API_VERSION` - This is the default API version of the custom resource that defines your microservice-specific configuration
- `RESOURCE_NAMESPACE` - This is the namespace of the custom resource that defines your microservice-specific configuration
- `CONFIG_REPO_URL` - This is the url to the git repository that contains your main configuration template
- `SYNC_INTERVAL` - This defines how often the controller check for new updates in your `CONFIG_REPO_URL`

4. Create a k8s deployment that uses the above service account and the configmap
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apptemplate-controller
spec:
  replicas: 1
  selector:
    matchLabels:
      app: apptemplate-controller
  template:
    metadata:
      labels:
        app: apptemplate-controller
    spec:
      serviceAccountName: app-template
      containers:
        - name: apptemplate
          image: drayfocus/apptemplate-controller:0.49
          ports:
            - containerPort: 8080
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: app-template-config
```
5. Finally, apply all these configurations to your cluster.
