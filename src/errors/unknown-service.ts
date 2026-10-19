class UnknownServiceError extends Error {
  constructor(serviceName: string) {
    super(`Unfamiliar with service named ${serviceName}, is it available in your country?`);
    this.name = 'UnknownServiceError';
  }
}

export = UnknownServiceError;
