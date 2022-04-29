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
$ deno bench -A --unstable bench.ts 
cpu: AMD Ryzen 5 2600 Six-Core Processor
runtime: deno 1.21.0 (x86_64-unknown-linux-gnu)

file:///home/eli/repos/solana-fast-tester/bench.ts
benchmark                                    time (avg)             (min … max)       p75       p99      p995
------------------------------------------------------------------------------- -----------------------------
solana-fast-tester transfer lamports       2.29 ms/iter     (1.61 ms … 3.95 ms)   2.25 ms   3.52 ms   3.72 ms
solana-test-validator transfer lamports  405.98 ms/iter (402.39 ms … 408.98 ms) 406.91 ms 408.98 ms 408.98 ms

summary
  solana-fast-tester transfer lamports
   177.04x times faster than solana-test-validator transfer lamports
```


500 TX/S NO MORE RATE LIMITING