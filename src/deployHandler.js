// import kubernetes client
const k8s = require("@kubernetes/client-node")
const { applyAppTemplate } = require("./config")
require('dotenv').config()

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Get app template list using k8s custom api

const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

const listAppTemplates = () => k8sCustomApi.listNamespacedCustomObject(
	process.env.RESOURCE_GROUP,
	process.env.API_VERSION,
	"*",
	process.env.RESOURCE_NAME
)

const fetchTemplates = () => {
	listAppTemplates().then((response, obj) => {

		console.log(response)
		console.log(obj)
	})
}


// Create and run an informer to listen for custom app template resources

const initiateInformer = () => {
	// const informer = k8s.makeInformer(kc, `/apis/${process.env.RESOURCE_GROUP}/${process.env.API_VERSION}/namespaces/*/${process.env.RESOURCE_NAME}`, listAppTemplates);

	// informer.on('add', (obj) => {
	// 	console.log(`Added: ${obj.metadata.name}`);
	// 	applyAppTemplate(obj.spec).then(() => {
	// 		console.log("template applied")
	// 	})
	// });
	// informer.on('update', (obj) => {
	// 	console.log(`Updated: ${obj.metadata.name}`);
	// 	applyAppTemplate(obj.spec).then(() => {
	// 		console.log("template update applied")
	// 	})
	// });
	// informer.on('delete', (obj) => {
	// 	console.log(`Deleted: ${obj.metadata.name}`);
	// });
	// informer.on('error', (err) => {
	// 	console.error(err);
	// 	// Restart informer after 5sec
	// 	setTimeout(() => {
	// 		informer.start();
	// 	}, 5000);
	// });

	// informer.start();

	fetchTemplates()

	// const watch = new k8s.Watch(kc);
	// watch.watch(`/apis/${process.env.RESOURCE_GROUP}/${process.env.API_VERSION}/namespaces/*/${process.env.RESOURCE_NAME}`,
	// 	// optional query parameters can go here.
	// 	{

	// 	},
	// 	// callback is called for each received object.
	// 	(type, apiObj, watchObj) => {
	// 		if (type === 'ADDED') {
	// 			console.log('new object:');
	// 			applyAppTemplate(watchObj.spec).then(() => {
	// 				console.log("template applied")
	// 			})
	// 		} else if (type === 'MODIFIED') {
	// 			console.log('changed object:');
	// 			applyAppTemplate(watchObj.spec).then(() => {
	// 				console.log("template applied")
	// 			})
	// 		} else if (type === 'DELETED') {

	// 			console.log('deleted object:');
	// 		} else if (type === 'BOOKMARK') {

	// 			console.log(`bookmark: ${watchObj.metadata.resourceVersion}`);
	// 		} else {

	// 			console.log('unknown type: ' + type);
	// 		}
	// 		console.log(apiObj);
	// 	},
	// 	// done callback is called if the watch terminates normally
	// 	(err) => {
	// 		console.log(err);
	// 	})
	// 	.then((req) => {
	// 		// watch returns a request object which you can use to abort the watch.
	// 		setTimeout(() => { req.abort(); }, 10 * 1000);
	// 	});
}

module.exports = {
	initiateInformer
}


