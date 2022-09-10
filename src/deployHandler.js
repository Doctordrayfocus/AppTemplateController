// import kubernetes client
import * as k8s from '@kubernetes/client-node';
import {
	RESOURCE_GROUP,
	RESOURCE_NAME,
	API_VERSION,
	applyAppTemplate
} from './config'

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Get app template list using k8s custom api

const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

const listAppTemplates = k8sCustomApi.listClusterCustomObject(
	RESOURCE_GROUP,
	API_VERSION,
	RESOURCE_NAME
)

// Create and run an informer to listen for custom app template resources

const initiateInformer = () => {
	const informer = k8s.makeInformer(kc, `/apis/${RESOURCE_GROUP}/${API_VERSION}/namespaces/*/${RESOURCE_NAME}`, listAppTemplates);

	informer.on('add', (obj) => {
		console.log(`Added: ${obj.metadata.name}`);
		applyAppTemplate(obj.spec)
	});
	informer.on('update', (obj) => {
		console.log(`Updated: ${obj.metadata.name}`);
		applyAppTemplate(obj.spec)
	});
	informer.on('delete', (obj) => {
		console.log(`Deleted: ${obj.metadata.name}`);
	});
	informer.on('error', (err) => {
		console.error(err);
		// Restart informer after 5sec
		setTimeout(() => {
			informer.start();
		}, 5000);
	});

	informer.start();
}

export default {
	initiateInformer
}


