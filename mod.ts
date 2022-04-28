import { assertEquals, concat, varbigBytes, web3 } from "./deps.ts";

function u64(value: number | bigint): Uint8Array {
  return varbigBytes(BigInt(value), { dataType: "uint64", endian: "little" });
}

const DUMMY_BLOCKHASH = web3.PublicKey.default.toString();

const DylibParams = {
  init_runtime: { parameters: [], result: "pointer" },
  init_ptc: { parameters: ["pointer"], result: "pointer" },
  set_account: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "usize",
      "pointer",
      "u8",
      "pointer",
    ],
    result: "void",
  },
  process: {
    parameters: ["pointer", "pointer", "pointer", "usize", "pointer", "usize"],
    result: "u8",
  },
} as const;

function getLibName(name: string): string {
  return {
    "linux": `lib${name}.so`,
    "darwin": `lib${name}.dylib`,
    "windows": `${name}.dll`,
  }[Deno.build.os];
}

const MEASURE = false;

function measure<Ret>(msg: string, cb: () => Ret): Ret {
  if (!MEASURE) return cb();
  const t0 = Date.now();
  const ret = cb();
  const dt = Date.now() - t0;
  console.log(`measure(${msg}): ${dt} ms`);
  return ret;
}

export interface ProcessOptions {
  payer: web3.PublicKey;
}

export class FastTester {
  readonly rt: Deno.UnsafePointer;
  readonly ptc: Deno.UnsafePointer;
  readonly dylib: Deno.DynamicLibrary<typeof DylibParams>;
  readonly defaultPayer = web3.Keypair.generate();
  constructor() {
    const libName = getLibName("solana_fast_tester");
    const libUrl = new URL(
      `./target/release/${libName}`,
      import.meta.url,
    );
    console.log({ libUrl });
    this.dylib = Deno.dlopen(libUrl, DylibParams);
    this.rt = this.dylib.symbols.init_runtime();
    this.ptc = this.dylib.symbols.init_ptc(this.rt);
    this.setAccount({
      address: this.defaultPayer.publicKey,
      lamports: 100n * BigInt(web3.LAMPORTS_PER_SOL),
    });
  }
  setAccount({
    address,
    lamports = 0,
    data = new Uint8Array(),
    owner = web3.SystemProgram.programId,
    executable = false,
    rentEpoch = 0,
  }: {
    address: web3.PublicKey;
    lamports?: number | bigint;
    data?: Uint8Array;
    owner?: web3.PublicKey;
    executable?: boolean;
    rentEpoch?: number | bigint;
  }) {
    this.dylib.symbols.set_account(
      this.ptc,
      address.toBytes(),
      u64(lamports),
      data,
      data.byteLength,
      owner.toBytes(),
      executable ? 1 : 0,
      u64(rentEpoch),
    );
  }
  /*
  addProgram(name: string, programId: PublicKey) {
    this.dylib.symbols.add_program(makeCStr(name), programId.toBytes());
  }
  start() {
    this.dylib.symbols.start(this.rt);
  }
  getLatestBlockhash(): string {
    const ptr = this.dylib.symbols.get_latest_blockhash(this.rt, this.ptc);
    const buf = new Uint8Array(32);
    new Deno.UnsafePointerView(ptr).copyInto(buf);
    return bs58.encode(buf);
  }
  processTx(tx: web3.Transaction) {
    const txBytes = measure("tx.serialize", () => tx.serialize());
    const err = measure("process_tx", () => {
      return this.dylib.symbols.process_tx(
        this.rt,
        this.ptc,
        txBytes,
        txBytes.byteLength,
      );
    })
    if (err) {
      throw new Error("fast tester process_tx returned err");
    }
  }
  */
  process(
    ix: web3.TransactionInstruction | web3.TransactionInstruction[],
    signers: web3.Keypair[] = [this.defaultPayer],
  ) {
    const ixs = Array.isArray(ix) ? ix : [ix];
    const tx = new web3.Transaction({
      recentBlockhash: DUMMY_BLOCKHASH,
      feePayer: signers[0].publicKey,
    });
    tx.add(...ixs);
    const msg = measure("tx.compileMessage()", () => tx.compileMessage());
    const msgBytes = measure("msg.serialize()", () => msg.serialize());
    const signersBytes = concat(...signers.map((kp) => kp.secretKey));
    assertEquals(signersBytes.length, signers.length * 64);

    const err = measure("ffi::process", () => {
      return this.dylib.symbols.process(
        this.rt,
        this.ptc,
        msgBytes,
        msgBytes.byteLength,
        signersBytes,
        signers.length,
      );
    });
    if (err) {
      throw new Error("fast tester process returned err");
    }

    /*
    const recentBlockhash = this.getLatestBlockhash();
    tx.add(...ixs);
    measure("msg.serialize()", () => msg.serialize());
    measure("sign", () => {
      if (signers) {
        tx.partialSign(...signers);
      }
      if (feePayer.equals(this.defaultPayer)) {
        tx.partialSign(this.defaultPayerKp);
      }
    });
    measure("processTx", () => this.processTx(tx));
    */
  }
  close() {
    this.dylib.close();
  }
}

export function withFastTester<Ret>(
  cb: (ft: FastTester) => Ret,
): Ret {
  const ft = new FastTester();
  const ret = cb(ft);
  ft.close();
  return ret;
}

/*
function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const ft = new FastTester({});
Deno.bench("add_u32", () => {
  ft.dylib.symbols.add_u32(1234, 5678);
});

const alice = web3.Keypair.generate();
ft.setAccount({
  address: alice.publicKey,
  lamports: 100n * BigInt(web3.LAMPORTS_PER_SOL),
});
const bob = web3.Keypair.generate();
ft.setAccount({
  address: bob.publicKey,
  lamports: 100n * BigInt(web3.LAMPORTS_PER_SOL),
});

let i = 0;
Deno.bench("process", () => {
  ft.process(
    web3.SystemProgram.transfer({
      fromPubkey: alice.publicKey,
      toPubkey: bob.publicKey,
      lamports: i,
    }),
    ft.defaultPayer,
    [alice],
  );
  i++;
});
*/
// await sleep(5000);
