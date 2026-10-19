import stream = require('stream');

function streamer(str: string): stream.Readable {
  const mockedStream = new stream.Readable();

  mockedStream._read = function noop(): void {
    // No-op required by the Readable interface.
  };

  setImmediate(() => {
    mockedStream.push(str);
    mockedStream.push(null);
  });

  return mockedStream;
}

export = streamer;
