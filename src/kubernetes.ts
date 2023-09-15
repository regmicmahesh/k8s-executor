import https from "https";
import yaml from "js-yaml";
import axios, { AxiosInstance } from "axios";
import { readFileSync } from "fs";
import { join } from "path";
import WebSocket from "ws";

export type KubernetesClientConfig = {
    url: string;
    token: string;
};

const PYTHON_COMPILER_DEPLOYMENT = yaml.load(
    readFileSync(
        join(__dirname, "templates", "python-compiler-deployment.yaml"),
        "utf8"
    )
);

const VALID_SUBPROTOCOLS = ["v4", "v3", "v2", "v1"].map(
    (v) => `${v}.channel.k8s.io`
);

export class KubernetesClient {
    protected axiosClient: AxiosInstance;

    constructor(private config: KubernetesClientConfig) {
        this.axiosClient = axios.create({
            baseURL: config.url,
            headers: {
                Authorization: `Bearer ${config.token}`,
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
    }

    getUrl() {
        return this.config.url;
    }

    getToken() {
        return this.config.token;
    }

    async getDeployment(namespace: string, name: string) {
        try {
            const deployments = await this.axiosClient.get(
                `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
            );
            console.log(deployments.data.spec.selector);
        } catch (err) {
            console.log((err as any).response.data);
        }
    }

    async createDeployment(namespace: string, deployment: any) {
        try {
            await this.axiosClient.post(
                `/apis/apps/v1/namespaces/${namespace}/deployments`,
                deployment
            );
        } catch (err) {
            console.log((err as any).response.data);
        }
    }

    async removeLabelFromPod(namespace: string, name: string, label: string) {
        try {
            await this.axiosClient.patch(
                `/api/v1/namespaces/${namespace}/pods/${name}?fieldManager=kubectl-label`,
                { metadata: { labels: { [label]: null } } },
                {
                    headers: {
                        "Content-Type": "application/merge-patch+json",
                    },
                }
            );
        } catch (err) {
            console.log((err as any).response.data);
        }
    }

    async deletePod(namespace: string, name: string) {
        try {
            await this.axiosClient.delete(
                `/api/v1/namespaces/${namespace}/pods/${name}`
            );
        } catch (err) {
            console.log((err as any).response.data);
        }
    }

    async getPodsWithLabel(namespace: string, labelSelector: string) {
        const pods = await this.axiosClient.get(
            `/api/v1/namespaces/${namespace}/pods?labelSelector=${labelSelector}`
        );
        return pods.data.items;
    }
}

export class PythonCompilerClient {
    constructor(private kubernetesClient: KubernetesClient) { }

    // need to find a better place to store this
    async initialize() {
        await this.kubernetesClient.createDeployment(
            "default",
            PYTHON_COMPILER_DEPLOYMENT
        );
    }

    private async extractPod() {
        const labelSelector = encodeURIComponent("app=python-compiler");

        const pods = await this.kubernetesClient.getPodsWithLabel(
            "default",
            labelSelector
        );

        const firstPod = pods[0];

        await this.kubernetesClient.removeLabelFromPod(
            "default",
            firstPod.metadata.name,
            "app"
        );

        return firstPod;
    }

    async getWsConnection() {
        const pod = await this.extractPod();

        const podName = pod.metadata?.name!;

        const url = `${this.kubernetesClient.getUrl()}/api/v1/namespaces/default/pods/${podName}/exec?command=python&stdin=true&stdout=true&stderr=true&tty=true`;

        const conn = new WebSocket(url, VALID_SUBPROTOCOLS, {
            rejectUnauthorized: false,
            headers: {
                Authorization: `Bearer ${this.kubernetesClient.getToken()}`,
            },
        });

        return { conn, connId: podName };
    }

    async cleanup(connId: string) {
        await this.kubernetesClient.deletePod("default", connId);
    }
}
