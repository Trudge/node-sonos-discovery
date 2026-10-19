'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const soap = require('../../helpers/soap');
const POLARITY = require('../../types/sub-polarity');
const TYPE = soap.TYPE;
function subPolarity(polarity) {
    polarity = polarity == POLARITY.INVERSE ? POLARITY.INVERSE : POLARITY.NONE;
    return soap.invoke(`${this.baseUrl}/MediaRenderer/RenderingControl/Control`, TYPE.SetEQ, { eqType: 'SubPolarity', value: polarity });
}
module.exports = subPolarity;
