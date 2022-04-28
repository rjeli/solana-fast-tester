import { assertEquals, web3 } from "./deps.ts";
import { withFastTester } from "./mod.ts";

Deno.test("works", () => {
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
});
