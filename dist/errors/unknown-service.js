"use strict";
class UnknownServiceError extends Error {
    constructor(serviceName) {
        super(`Unfamiliar with service named ${serviceName}, is it available in your country?`);
        this.name = 'UnknownServiceError';
    }
}
module.exports = UnknownServiceError;
