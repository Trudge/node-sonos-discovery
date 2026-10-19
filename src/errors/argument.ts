class ArgumentError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'ArgumentError';
  }
}

export = ArgumentError;
