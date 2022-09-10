// import kubernetes client
import * as k8s from '@kubernetes/client-node';

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

