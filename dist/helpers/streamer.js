"use strict";
const stream = require("stream");
function streamer(str) {
    const mockedStream = new stream.Readable();
    mockedStream._read = function noop() {
        // No-op required by the Readable interface.
    };
    setImmediate(() => {
        mockedStream.push(str);
        mockedStream.push(null);
    });
    return mockedStream;
}
module.exports = streamer;
