/**
 * TestSandboxProvider (spec Fase 5, secao 142): backend de ciclo de vida.
 *
 * NAO simula seguranca fisica e NAO deve ser marcado como `full`. Ele
 * existe para exercitar lifecycle, contexto, eventos e cleanup — e para
 * que os testes de falha (apply que explode, dispose que explode) tenham
 * um backend honesto onde acontecer.
 */
export class TestSandboxProvider {
  providerId = 'test-sandbox';
  version = '1.0.0';
  platforms = ['*'];
  capabilities = ['filesystem-read-boundary', 'filesystem-write-boundary'];
  enforcement = 'none'; // nunca alegar isolamento que nao existe
  modes = ['read-only', 'workspace-write', 'danger-full-access'];

  applied = [];
  disposed = 0;

  #failApply;
  #failDispose;
  #declaredEnforcement;

  constructor({ failApply = null, failDispose = null, enforcement = 'none' } = {}) {
    this.#failApply = failApply;
    this.#failDispose = failDispose;
    this.#declaredEnforcement = enforcement;
    this.enforcement = enforcement;
  }

  supports({ mode, requiredEnforcement }) {
    if (!this.modes.includes(mode)) return false;
    // honestidade estrutural (secao 143): nunca aceitar um pedido de
    // enforcement acima do que este backend declara entregar. O contrato
    // da secao 154 pegou justamente esta falha aqui.
    const ranks = { none: 0, partial: 1, full: 2 };
    if (requiredEnforcement && ranks[requiredEnforcement] > ranks[this.#declaredEnforcement]) {
      return false;
    }
    return true;
  }

  describe(policy) {
    return Object.freeze({
      providerId: this.providerId,
      version: this.version,
      platform: 'test',
      backend: 'no isolation (lifecycle only)',
      mode: policy.mode,
      enforcement: this.#declaredEnforcement,
      readableRootCount: policy.readableRoots.length,
      writableRootCount: policy.writableRoots.length,
      network: policy.network.enforcement,
    });
  }

  async apply(policy, context) {
    if (this.#failApply) throw this.#failApply;
    this.applied.push({ mode: policy.mode, sessionId: context.sessionId });
    let disposed = false;
    const failDispose = this.#failDispose;
    const self = this;
    return Object.freeze({
      mode: policy.mode,
      enforcement: this.#declaredEnforcement,
      providerId: this.providerId,
      sandboxInstanceId: 'sbx_test_' + this.applied.length,
      boundary: policy.boundary,
      sessionTemp: null,
      assertPathAllowed() {},
      // superficie uniforme (R8): backend sem confinement fisico de
      // processo expoe a porta como null, nunca a omite
      confineProcess: null,
      async dispose() {
        if (disposed) return;
        disposed = true;
        self.disposed += 1;
        if (failDispose) throw failDispose;
      },
    });
  }
}
