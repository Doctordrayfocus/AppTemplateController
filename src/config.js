// import kubernetes client
import * as k8s from '@kubernetes/client-node';

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// controller const parameters
const RESOURCE_GROUP = "myapp.domain.com"
const RESOURCE_NAME = "apptemplates"
const API_VERSION = "v1"
const DOCKER_REGISTRY = "drayfocus"



// Apply configurations using K8s core api
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const applyConfiguration = ({ type, yamlString, namespace }) => {
	const yamlConfigContent = k8s.loadYaml(yamlString);

	const requestInitiator = () => {
		switch (type) {
			case 'namespace':
				return k8sCoreApi.createNamespace(yamlConfigContent)
			case 'service':
				return k8sCoreApi.createNamespacedService(namespace, yamlConfigContent)
			case 'deployment':
				return k8sCoreApi.createNamespacedPod(namespace, yamlConfigContent)
			default:
				break;
		}
	}

	requestInitiator().then(
		(response) => {
			console.log('Resource created');
		},
		(err) => {
			console.log('Error!: ' + err);
		}
	);
}

// create or update app configurations using the template configurations

const applyAppTemplate = (templateConfig) => {
	// apply namespace first


	// apply other configurations

}

export {
    RESOURCE_GROUP,
    RESOURCE_NAME,
    API_VERSION,
    applyAppTemplate
}