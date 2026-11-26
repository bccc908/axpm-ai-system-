export class AuthSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthSecretError";
  }
}
