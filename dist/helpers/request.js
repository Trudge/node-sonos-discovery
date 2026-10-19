"use strict";
const http = require("http");
const https = require("https");
const url = require("url");
const agent = new http.Agent({ keepAlive: false });
class RequestError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'RequestError';
    }
    setStack(stack) {
        const newStack = [`Error: ${this.message}`];
        this.stack = newStack.concat((stack || '').split('\n').slice(1)).join('\n');
    }
}
class RequestFailedError extends RequestError {
    body;
    statusCode;
    statusMessage;
    path;
    constructor(options, res) {
        super(`Got status ${res.statusCode} when invoking ${options.path}`);
        Object.assign(this, options);
        this.name = 'RequestFailedError';
        this.statusCode = res.statusCode || 0;
        this.statusMessage = res.statusMessage;
    }
}
function request(options) {
    const stackHolder = {};
    Error.captureStackTrace(stackHolder, request);
    return new Promise((resolve, reject) => {
        const uri = url.parse(options.uri);
        const httpModule = uri.protocol === 'https:' ? https : http;
        const defaultPort = uri.protocol === 'https:' ? 443 : 80;
        const requestOptions = {
            agent,
            method: options.method || 'GET',
            path: uri.path,
            host: uri.hostname || '',
            port: uri.port ? parseInt(uri.port, 10) : defaultPort
        };
        if (options.headers) {
            requestOptions.headers = options.headers;
        }
        const client = httpModule.request(requestOptions, (res) => {
            const chunks = [];
            const statusCode = res.statusCode === undefined ? 200 : res.statusCode;
            if (statusCode < 200 || statusCode > 299) {
                const error = new RequestFailedError(requestOptions, res);
                error.setStack(stackHolder.stack);
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    error.body = Buffer.concat(chunks).toString();
                    reject(error);
                });
                return;
            }
            if (options.type && options.type.toLowerCase() === 'stream') {
                resolve(res);
                return;
            }
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                if (options.type && options.type.toLowerCase() === 'json') {
                    resolve(JSON.parse(body));
                    return;
                }
                resolve(body);
            });
        });
        client.on('error', reject);
        client.on('timeout', () => {
            const error = new RequestError('http request timed out');
            error.setStack(stackHolder.stack);
            reject(error);
        });
        if (options.timeout) {
            client.setTimeout(options.timeout);
        }
        if (options.body) {
            client.write(options.body);
        }
        client.end();
    });
}
module.exports = request;
