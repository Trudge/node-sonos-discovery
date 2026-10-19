"use strict";
class ArgumentError extends Error {
    constructor(m) {
        super(m);
        this.name = 'ArgumentError';
    }
}
module.exports = ArgumentError;
