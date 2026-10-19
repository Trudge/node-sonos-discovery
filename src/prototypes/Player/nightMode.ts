'use strict';
const soap = require('../../helpers/soap');
const TYPE = soap.TYPE;

function nightMode(this: any, enable: any) {
  const value = enable ? '1' : '0';
  return soap.invoke(
    `${this.baseUrl}/MediaRenderer/RenderingControl/Control`,
    TYPE.SetEQ,
    { eqType: 'NightMode', value });
};

module.exports = nightMode;
