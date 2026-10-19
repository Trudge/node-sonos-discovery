import streamer = require('./streamer');
import flow = require('xml-flow');

interface Service {
  id: number;
  capabilities: number;
  type: number;
}

function parseServices(servicesXML: any): Promise<Record<string, Service>> {
  const services: Record<string, Service> = {};

  return new Promise((resolve, reject) => {
    const stream = streamer(servicesXML.availableservicedescriptorlist);
    const sax = flow(stream, { preserveMarkup: flow.NEVER });

    sax.on('tag:service', (service: any) => {
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

export = parseServices;
