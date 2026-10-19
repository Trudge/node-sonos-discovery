"use strict";
const streamer = require("./streamer");
const flow = require("xml-flow");
function parseServices(servicesXML) {
    const services = {};
    return new Promise((resolve, reject) => {
        const stream = streamer(servicesXML.availableservicedescriptorlist);
        const sax = flow(stream, { preserveMarkup: flow.NEVER });
        sax.on('tag:service', (service) => {
            const serviceID = parseInt(service.$attrs.id, 10);
            services[service.$attrs.name] = {
                id: serviceID,
                capabilities: parseInt(service.$attrs.capabilities, 10),
                type: (serviceID << 8) + 7
            };
        });
        sax.on('end', () => resolve(services));
        sax.on('error', reject);
    });
}
module.exports = parseServices;
