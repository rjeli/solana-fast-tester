Tired of SLOW SOLANA TESTING?? Use SOLANA FAST TESTER for VERY FAST TESTING

You dont have to write your client in rust for solana-program-test or figure out tokio!! Just:

```typescript
import { withFastTester } from "./mod.ts";
withFastTester((ft) => {
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
ft.process(
  web3.SystemProgram.transfer({
    fromPubkey: alice.publicKey,
    toPubkey: bob.publicKey,
    lamports: 1,
  }),
  [alice],
);
});
```

WOW SO FAST:

```bash
cpu: AMD Ryzen 5 2600 Six-Core Processor
runtime: deno 1.21.0 (x86_64-unknown-linux-gnu)

file:///home/eli/repos/solana-fast-tester/bench.ts
benchmark                                 time (avg)             (min … max)       p75       p99      p995
---------------------------------------------------------------------------- -----------------------------
solana-fast-tester transfer lamports    2.03 ms/iter     (1.51 ms … 2.91 ms)   2.27 ms   2.78 ms   2.78 ms
```