import { createWriteStream, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Coleta de saida limitada (spec Fase 6, secoes 49-53, 105).
 *
 * maxBytes e controle de SEGURANCA, nao conveniencia (secao 105): saida
 * ilimitada e pressao de memoria, exaustao de disco e flood de eventos.
 * Quando o limite estoura, `truncated = true` — o texto devolvido NUNCA
 * finge ser completo (secao 52). O excedente pode ir para um spill
 * opcional, ele proprio limitado (secao 51) e dentro do mundo permitido
 * pelo Sandbox (secao 53) — a validacao do diretorio e de quem monta.
 */
export class OutputCollector {
  #chunks = [];
  #bytes = 0;
  #maxBytes;
  #truncated = false;
  #spill = null;
  #spillBytes = 0;
  #spillPath = null;

  constructor({ maxBytes, spill = null }) {
    this.#maxBytes = maxBytes;
    if (spill) {
      mkdirSync(spill.dir, { recursive: true });
      this.#spillPath = path.join(spill.dir, 'spill-' + randomUUID() + '.log');
      this.#spill = { stream: createWriteStream(this.#spillPath), maxBytes: spill.maxBytes };
    }
  }

  write(chunk) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    const room = this.#maxBytes - this.#bytes;
    if (room > 0) {
      const kept = buffer.subarray(0, room);
      this.#chunks.push(kept);
      this.#bytes += kept.length;
      if (kept.length < buffer.length) this.#truncated = true;
    } else {
      this.#truncated = true;
    }
    // excedente vai ao spill, tambem limitado — nunca arquivo sem teto
    if (this.#truncated && this.#spill) {
      const overflowStart = Math.max(0, room);
      const overflow = buffer.subarray(overflowStart);
      const spillRoom = this.#spill.maxBytes - this.#spillBytes;
      if (spillRoom > 0) {
        const spilled = overflow.subarray(0, spillRoom);
        this.#spill.stream.write(spilled);
        this.#spillBytes += spilled.length;
      }
    }
  }

  /** @returns {{text: string, truncated: boolean, bytes: number, spillPath: string|null}} */
  async finish() {
    if (this.#spill) {
      await new Promise((resolve) => this.#spill.stream.end(resolve));
    }
    return Object.freeze({
      text: Buffer.concat(this.#chunks).toString('utf8'),
      truncated: this.#truncated,
      bytes: this.#bytes,
      spillPath: this.#spillBytes > 0 ? this.#spillPath : null,
    });
  }

  /** Remove o spill do disco (secao 155: spill cleanup). */
  cleanup() {
    if (this.#spillPath) rmSync(this.#spillPath, { force: true });
  }
}
