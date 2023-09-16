import https from "https";
import axios, { AxiosInstance } from "axios";
import WebSocket from "ws";

export type KubernetesClientConfig = {
    url: string;
    token: string;
};

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

    async getWsConnection(namespace: string, podName: string, cmd: string) {
        const url = `${this.config.url}/api/v1/namespaces/${namespace}/pods/${podName}/exec?command=${cmd}&stdin=true&stdout=true&stderr=true&tty=true`;

        const conn = new WebSocket(url, VALID_SUBPROTOCOLS, {
            rejectUnauthorized: false,
            headers: {
                Authorization: `Bearer ${this.config.token}`,
            },
        });

        return { conn, podName };
    }
}
